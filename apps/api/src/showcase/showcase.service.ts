import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  JobType,
  ProjectType,
  ShowcaseBlock,
  ShowcaseBlockKind,
  ShowcaseBlockSource,
  ShowcaseView,
  FeaturedProject,
  GalleryBlockPayloadSchema,
  NotebookBlockPayloadSchema,
  TerminalBlockPayloadSchema,
  OpenApiBlockPayloadSchema,
  parseBlockPayload,
} from '@talentshowcase/types';
import { Project } from '../projects/project.entity';
import { ProjectFile } from '../projects/project-file.entity';
import { ProjectsService } from '../projects/projects.service';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ShowcaseBlock as ShowcaseBlockEntity } from './showcase-block.entity';
import { StorytellerAgent } from '../ai/agents/storyteller.agent';

/** Image extensions recognised for galleries / hero thumbnails. */
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
/** Files that look like captured CLI output and become terminal replays. */
const TERMINAL_EXTS = ['.log', '.txt'];
const TERMINAL_NAME_HINTS = ['output', 'result', 'run', 'terminal'];
const SPEC_NAMES = ['openapi', 'swagger'];
const NB_MAX_BYTES = 2_000_000;
const SPEC_MAX_BYTES = 1_000_000;
const LOG_MAX_BYTES = 512_000;
const IMAGE_OUTPUT_CAP = 300_000; // base64 chars per notebook image output

/**
 * Showcase pipeline (Phase A): turns a project's uploaded files into an
 * ordered visual story —
 *
 *   files ──scan──▶ GALLERY / NOTEBOOK / OPENAPI / TERMINAL blocks
 *          ──AI───▶ STORY block (plain-language, non-technical audience)
 *
 * Rebuilds are idempotent: AUTO/AI blocks are regenerated, USER blocks are
 * preserved (they keep their relative order right after the story).
 */
@Injectable()
export class ShowcaseService implements OnModuleInit {
  private readonly logger = new Logger(ShowcaseService.name);

  constructor(
    @InjectRepository(ShowcaseBlockEntity)
    private readonly blockRepo: Repository<ShowcaseBlockEntity>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectFile)
    private readonly fileRepo: Repository<ProjectFile>,
    private readonly projectsService: ProjectsService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly notifications: NotificationsService,
    private readonly storyteller: StorytellerAgent,
  ) {}

  /* --------------------------- queue wiring --------------------------- */

  onModuleInit(): void {
    this.queue.registerHandler(JobType.SHOWCASE_BUILD, async (job) =>
      this.buildShowcase(String(job.payload.projectId)),
    );
  }

  /** Queue an async (re)build of the showcase. */
  async enqueueBuild(projectId: string, requestedById?: string) {
    const job = await this.queue.enqueue(
      JobType.SHOWCASE_BUILD,
      { projectId },
      { projectId, requestedById },
    );
    return { jobId: job.id };
  }

  /* ------------------------------- reads ------------------------------ */

  async getShowcase(projectId: string): Promise<ShowcaseView> {
    const project = await this.projectsService.findById(projectId);
    const blocks = await this.blockRepo.find({
      where: { projectId },
      order: { position: 'ASC' },
    });
    return {
      projectId,
      kind: (project.showcaseKind ?? project.type) as ProjectType,
      blocks: blocks.map(this.toDto),
    };
  }

  /** Featured projects for the Discover hero carousel (approved/high-scored first). */
  async featured(limit = 3): Promise<FeaturedProject[]> {
    const rows = await this.projectRepo
      .createQueryBuilder('p')
      .where("p.status != 'ARCHIVED'")
      .orderBy("CASE WHEN p.status = 'APPROVED' THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('p.aiScore', 'DESC', 'NULLS LAST')
      .addOrderBy('p.createdAt', 'DESC')
      .take(limit)
      .getMany();
    const heroMap = await this.heroFileIds(rows.map((p) => p.id));
    return rows.map((p) => ({ project: p, heroFileId: heroMap.get(p.id) ?? null }));
  }

  /** First image file per project (for Discover card thumbnails). */
  async heroImages(projectIds: string[]): Promise<Record<string, string | null>> {
    const map = await this.heroFileIds(projectIds);
    return Object.fromEntries(projectIds.map((id) => [id, map.get(id) ?? null]));
  }

  /** First image file per project (for Discover card thumbnails) — raw map form. */
  async heroFileIds(projectIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (projectIds.length === 0) return result;
    const rows: Array<{ id: string; project_id: string }> = await this.fileRepo.manager.query(
      `SELECT DISTINCT ON (project_id) id, project_id
       FROM project_file
       WHERE project_id = ANY($1::uuid[])
         AND (lower(path) ~ '\\.(png|jpe?g|gif|webp|svg|bmp)$')
       ORDER BY project_id, created_at ASC`,
      [projectIds],
    );
    for (const f of rows) result.set(f.project_id, f.id);
    return result;
  }

  /* ------------------------------ writes ------------------------------ */

  /** Reorder blocks (drag & drop). The id set must match exactly. */
  async reorder(projectId: string, orderedIds: string[]): Promise<ShowcaseBlock[]> {
    const blocks = await this.blockRepo.find({ where: { projectId } });
    if (blocks.length !== orderedIds.length || new Set(blocks.map((b) => b.id)).size !== orderedIds.length) {
      throw new NotFoundException('Block list mismatch — refresh and try again');
    }
    const byId = new Map(blocks.map((b) => [b.id, b]));
    for (let i = 0; i < orderedIds.length; i++) {
      const block = byId.get(orderedIds[i]);
      if (!block) throw new NotFoundException(`Unknown block ${orderedIds[i]}`);
      block.position = i;
    }
    await this.blockRepo.save([...byId.values()]);
    return (await this.getShowcase(projectId)).blocks;
  }

  async deleteBlock(projectId: string, blockId: string): Promise<void> {
    const block = await this.blockRepo.findOne({ where: { id: blockId, projectId } });
    if (!block) throw new NotFoundException('Block not found');
    await this.blockRepo.remove(block);
    await this.normalizePositions(projectId);
  }

  /** Add a user-authored block (terminal replay from pasted log, gallery from files). */
  async addBlock(projectId: string, kind: ShowcaseBlockKind, payload: unknown): Promise<ShowcaseBlock> {
    if (kind !== ShowcaseBlockKind.GALLERY && kind !== ShowcaseBlockKind.TERMINAL) {
      throw new NotFoundException(`Block kind "${kind}" cannot be added manually`);
    }
    // GALLERY payload fileIds must belong to this project
    if (kind === ShowcaseBlockKind.GALLERY) {
      const parsed = GalleryBlockPayloadSchema.parse(payload);
      const fileIds = parsed.items.map((i) => i.fileId);
      const files = await this.projectsService.getFiles(projectId);
      const owned = new Set(files.map((f) => f.id));
      if (!fileIds.every((id) => owned.has(id))) {
        throw new NotFoundException('Gallery references files outside this project');
      }
    }
    const valid = parseBlockPayload(kind, payload) as Record<string, unknown>;
    const maxPos = await this.blockRepo.maximum('position', { projectId });
    const saved = await this.blockRepo.save(
      this.blockRepo.create({
        projectId,
        kind,
        payload: valid,
        source: ShowcaseBlockSource.USER,
        position: (maxPos ?? -1) + 1,
      }),
    );
    return this.toDto(saved);
  }

  /** Override the visual profile and rebuild the auto blocks. */
  async setKind(projectId: string, kind: ProjectType): Promise<ShowcaseView> {
    await this.projectsService.update(projectId, { showcaseKind: kind });
    await this.buildShowcase(projectId);
    return this.getShowcase(projectId);
  }

  /* ---------------------------- build pipeline ------------------------- */

  async buildShowcase(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.projectsService.findById(projectId);
    const files = await this.projectsService.getFiles(projectId);

    const generated: Array<Pick<ShowcaseBlockEntity, 'kind' | 'payload' | 'source'>> = [];
    const parts: string[] = [];

    // 1. Content-driven blocks from uploaded files
    const imageFiles = files.filter((f) => IMAGE_EXTS.some((e) => f.path.toLowerCase().endsWith(e)));
    if (imageFiles.length > 0) {
      const payload = GalleryBlockPayloadSchema.parse({
        title: imageFiles.length > 1 ? `Visual output (${imageFiles.length})` : 'Visual output',
        items: imageFiles.slice(0, 24).map((f) => ({
          fileId: f.id,
          caption: f.path.split('/').pop()?.replace(/_/g, ' '),
        })),
      });
      generated.push({ kind: ShowcaseBlockKind.GALLERY, payload, source: ShowcaseBlockSource.AUTO });
      parts.push(`${Math.min(imageFiles.length, 24)} image${imageFiles.length === 1 ? '' : 's'}`);
    }

    const notebooks = files.filter((f) => f.path.toLowerCase().endsWith('.ipynb'));
    for (const nb of notebooks.slice(0, 2)) {
      const payload = await this.parseNotebook(nb);
      if (payload) {
        generated.push({
          kind: ShowcaseBlockKind.NOTEBOOK,
          payload: NotebookBlockPayloadSchema.parse(payload),
          source: ShowcaseBlockSource.AUTO,
        });
        parts.push(`notebook ${nb.path.split('/').pop()}`);
      }
    }

    const specs = files.filter((f) => {
      const name = f.path.toLowerCase();
      return (
        SPEC_NAMES.some((s) => name.includes(s)) &&
        (name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml'))
      );
    });
    for (const spec of specs.slice(0, 1)) {
      const payload = await this.parseOpenApi(spec);
      if (payload) {
        generated.push({
          kind: ShowcaseBlockKind.OPENAPI,
          payload: OpenApiBlockPayloadSchema.parse(payload),
          source: ShowcaseBlockSource.AUTO,
        });
        parts.push(`${payload.endpoints.length} API endpoints`);
      }
    }

    const logs = files.filter((f) => {
      const name = f.path.toLowerCase();
      const base = name.split('/').pop() ?? name;
      return (
        TERMINAL_NAME_HINTS.some((h) => base.includes(h)) &&
        TERMINAL_EXTS.some((e) => name.endsWith(e))
      );
    });
    for (const log of logs.slice(0, 1)) {
      const payload = await this.parseTerminal(log);
      if (payload) {
        generated.push({
          kind: ShowcaseBlockKind.TERMINAL,
          payload: TerminalBlockPayloadSchema.parse(payload),
          source: ShowcaseBlockSource.AUTO,
        });
        parts.push('terminal replay');
      }
    }

    // 2. AI story (uses deterministic fallback when no LLM key is configured)
    const story = await this.storyteller.generate({
      title: project.title,
      type: project.showcaseKind ?? project.type,
      description: project.description ?? undefined,
      techStack: project.techStack ?? [],
      fileNames: files.map((f) => f.path),
      blockSummary: parts.join(', '),
    });
    const storyBlock: Pick<ShowcaseBlockEntity, 'kind' | 'payload' | 'source'> = {
      kind: ShowcaseBlockKind.STORY,
      payload: story as unknown as Record<string, unknown>,
      source: ShowcaseBlockSource.AI,
    };

    // 3. Persist: story first, preserved USER blocks next, fresh AUTO blocks last
    const existing = await this.blockRepo.find({
      where: { projectId },
      order: { position: 'ASC' },
    });
    const userBlocks = existing.filter((b) => b.source === ShowcaseBlockSource.USER);
    const autoIds = existing.filter((b) => b.source !== ShowcaseBlockSource.USER).map((b) => b.id);
    if (autoIds.length) {
      await this.blockRepo.delete({ id: In(autoIds) });
    }

    const ordered = [storyBlock, ...userBlocks, ...generated];
    for (let i = 0; i < ordered.length; i++) {
      await this.blockRepo.save(
        this.blockRepo.create({ projectId, ...ordered[i], position: i }),
      );
    }

    this.notifications.notifyUser(project.ownerId, 'showcase:ready', {
      projectId,
      blocks: ordered.length,
    });
    this.logger.log(`Showcase built for "${project.title}": ${ordered.length} block(s)`);
    return { blocks: ordered.length, kinds: ordered.map((b) => b.kind) };
  }

  /* ------------------------------ parsers ------------------------------ */

  /** Parse a .ipynb into renderable cells. Outputs are pre-executed only — code is never run. */
  private async parseNotebook(file: ProjectFile) {
    try {
      const buffer = await this.storage.get(file.s3Key);
      if (buffer.length > NB_MAX_BYTES) return null;
      const nb = JSON.parse(buffer.toString('utf8')) as {
        metadata?: { kernelspec?: { display_name?: string } };
        cells?: Array<{
          cell_type: string;
          source: string | string[];
          outputs?: Array<{
            output_type: string;
            text?: string | string[];
            data?: Record<string, string | Record<string, unknown>>;
            ename?: string;
            evalue?: string;
          }>;
        }>;
      };

      const cells = [];
      let truncated = false;
      for (const cell of nb.cells ?? []) {
        if (cells.length >= 40) {
          truncated = true;
          break;
        }
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source ?? '';
        const outputs = [];
        for (const out of cell.outputs ?? []) {
          if (outputs.length >= 10) break;
          if (out.output_type === 'stream' && out.text) {
            outputs.push({ kind: 'text', text: str(out.text).slice(0, 20_000) });
          } else if (
            (out.output_type === 'execute_result' || out.output_type === 'display_data') &&
            out.data
          ) {
            const png = out.data['image/png'];
            if (typeof png === 'string') {
              if (png.length > IMAGE_OUTPUT_CAP) {
                truncated = true;
              } else {
                outputs.push({ kind: 'image', mediaType: 'image/png', data: png });
              }
              continue;
            }
            const jpeg = out.data['image/jpeg'];
            if (typeof jpeg === 'string' && jpeg.length <= IMAGE_OUTPUT_CAP) {
              outputs.push({ kind: 'image', mediaType: 'image/jpeg', data: jpeg });
              continue;
            }
            const html = out.data['text/html'];
            if (typeof html === 'string') {
              if (html.length > 20_000) {
                truncated = true;
              } else {
                outputs.push({ kind: 'html', text: html });
              }
              continue;
            }
            const text = out.data['text/plain'];
            if (typeof text === 'string') {
              outputs.push({ kind: 'text', text: str(text).slice(0, 20_000) });
            }
          } else if (out.output_type === 'error') {
            outputs.push({
              kind: 'error',
              text: `${out.ename ?? 'Error'}: ${out.evalue ?? ''}`.slice(0, 2000),
            });
          }
        }
        if (cell.cell_type === 'markdown' || cell.cell_type === 'code') {
          cells.push({ type: cell.cell_type, source: source.slice(0, 8000), outputs });
        }
      }
      if (cells.length === 0) return null;
      return {
        title: file.path.split('/').pop(),
        fileId: file.id,
        kernelHint: nb.metadata?.kernelspec?.display_name,
        truncated,
        cells,
      };
    } catch (err) {
      this.logger.warn(`Notebook parse failed for ${file.path}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Parse an OpenAPI/Swagger spec (JSON or YAML) into a static endpoint list. */
  private async parseOpenApi(file: ProjectFile) {
    try {
      const buffer = await this.storage.get(file.s3Key);
      if (buffer.length > SPEC_MAX_BYTES) return null;
      const text = buffer.toString('utf8');
      let spec: {
        info?: { title?: string; version?: string; description?: string };
        paths?: Record<string, Record<string, { summary?: string; description?: string; tags?: string[] }>>;
      };
      try {
        spec = JSON.parse(text);
      } catch {
        // YAML
        const yaml = await import('js-yaml');
        spec = yaml.load(text) as typeof spec;
      }
      const endpoints = [];
      for (const [path, ops] of Object.entries(spec.paths ?? {})) {
        for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
          const op = ops?.[method];
          if (!op) continue;
          endpoints.push({
            method: method.toUpperCase(),
            path,
            summary: (op.summary ?? op.description ?? '').slice(0, 300),
            tags: (op.tags ?? []).slice(0, 5),
          });
          if (endpoints.length >= 100) break;
        }
        if (endpoints.length >= 100) break;
      }
      if (endpoints.length === 0) return null;
      endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
      return {
        title: spec.info?.title ?? file.path.split('/').pop(),
        version: spec.info?.version,
        description: spec.info?.description?.slice(0, 1000),
        specFileId: file.id,
        endpoints,
      };
    } catch (err) {
      this.logger.warn(`OpenAPI parse failed for ${file.path}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Turn a captured output/log file into terminal replay lines. */
  private async parseTerminal(file: ProjectFile) {
    try {
      const buffer = await this.storage.get(file.s3Key);
      if (buffer.length > LOG_MAX_BYTES) return null;
      const text = buffer.toString('utf8').replace(/\r\n/g, '\n');
      const lines = text.split('\n');
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
      if (lines.length === 0) return null;
      return {
        title: file.path.split('/').pop(),
        lines: lines.slice(0, 200).map((l) => l.slice(0, 500)),
      };
    } catch (err) {
      this.logger.warn(`Terminal parse failed for ${file.path}: ${(err as Error).message}`);
      return null;
    }
  }

  /* ------------------------------ helpers ------------------------------ */

  private async normalizePositions(projectId: string): Promise<void> {
    const blocks = await this.blockRepo.find({
      where: { projectId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].position !== i) {
        blocks[i].position = i;
        await this.blockRepo.save(blocks[i]);
      }
    }
  }

  private toDto(b: ShowcaseBlockEntity): ShowcaseBlock {
    return {
      id: b.id,
      projectId: b.projectId,
      position: b.position,
      kind: b.kind,
      payload: b.payload,
      source: b.source,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }
}

function str(v: string | string[]): string {
  return Array.isArray(v) ? v.join('') : v;
}
