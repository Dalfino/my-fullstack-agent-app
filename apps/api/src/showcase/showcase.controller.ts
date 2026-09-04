import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  CreateShowcaseBlockInput,
  CreateShowcaseBlockSchema,
  ProjectType,
  ReorderShowcaseInput,
  ReorderShowcaseSchema,
  SetShowcaseKindInput,
  SetShowcaseKindSchema,
  ShowcaseBlock,
  ShowcaseBlockKind,
  ShowcaseView,
  UserRole,
} from '@talentshowcase/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ShowcaseService } from './showcase.service';

interface AuthedRequest {
  user: { sub: string; email: string; role: UserRole };
}

/**
 * Showcase endpoints: the visual story of a project.
 *
 *  GET    /projects/:id/showcase              → ordered blocks + kind
 *  POST   /projects/:id/showcase/generate     → queue a (re)build
 *  POST   /projects/:id/showcase/blocks       → add manual block (terminal/gallery)
 *  PUT    /projects/:id/showcase/reorder      → drag & drop order
 *  PUT    /projects/:id/showcase/kind         → override visual profile + rebuild
 *  DELETE /projects/:id/showcase/blocks/:bid  → remove a block
 *  GET    /showcase/featured                  → hero carousel for Discover
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  /* ------------------------------ reads ------------------------------ */

  @Get('projects/:projectId/showcase')
  async view(@Param('projectId') projectId: string): Promise<ShowcaseView> {
    return this.showcase.getShowcase(projectId);
  }

  @Get('showcase/featured')
  async featured(@Query('limit') limitStr?: string) {
    const limit = Math.min(6, Math.max(1, parseInt(limitStr ?? '3', 10) || 3));
    return this.showcase.featured(limit);
  }

  /** Hero image file per project id (comma separated) — powers Discover thumbnails. */
  @Get('showcase/hero-images')
  async heroImages(@Query('ids') ids: string): Promise<Record<string, string | null>> {
    const list = (ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
      .slice(0, 60);
    return this.showcase.heroImages(list);
  }

  /* ----------------------------- mutations ---------------------------- */

  @Post('projects/:projectId/showcase/generate')
  async generate(
    @Param('projectId') projectId: string,
    @Request() req: AuthedRequest,
  ): Promise<{ jobId: string }> {
    return this.showcase.enqueueBuild(projectId, req.user.sub);
  }

  @Post('projects/:projectId/showcase/blocks')
  async addBlock(
    @Param('projectId') projectId: string,
    @Body() body: CreateShowcaseBlockInput,
    @Request() req: AuthedRequest,
  ): Promise<ShowcaseBlock> {
    const parsed = CreateShowcaseBlockSchema.parse(body);
    const payload = parsed.payload as Record<string, unknown> | null;
    if (parsed.kind === ShowcaseBlockKind.GALLERY) {
      return this.showcase.addBlock(projectId, ShowcaseBlockKind.GALLERY, payload);
    }
    return this.showcase.addBlock(projectId, ShowcaseBlockKind.TERMINAL, payload);
  }

  @Put('projects/:projectId/showcase/reorder')
  async reorder(
    @Param('projectId') projectId: string,
    @Body() body: ReorderShowcaseInput,
  ): Promise<ShowcaseBlock[]> {
    const parsed = ReorderShowcaseSchema.parse(body);
    return this.showcase.reorder(projectId, parsed.orderedIds);
  }

  @Put('projects/:projectId/showcase/kind')
  async setKind(
    @Param('projectId') projectId: string,
    @Body() body: SetShowcaseKindInput,
  ): Promise<ShowcaseView> {
    const parsed = SetShowcaseKindSchema.parse(body);
    return this.showcase.setKind(projectId, parsed.kind as ProjectType);
  }

  @Delete('projects/:projectId/showcase/blocks/:blockId')
  async deleteBlock(
    @Param('projectId') projectId: string,
    @Param('blockId') blockId: string,
  ): Promise<{ ok: true }> {
    await this.showcase.deleteBlock(projectId, blockId);
    return { ok: true };
  }
}
