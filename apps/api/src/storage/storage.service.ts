import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Storage abstraction with two drivers:
 *  - minio: S3-compatible object storage (matches docker-compose.yml)
 *  - local: local-disk fallback used in dev sandboxes / when MinIO is down
 *
 * Driver is chosen via STORAGE_DRIVER (minio|local|auto). In `auto` mode we
 * attempt MinIO once and permanently fall back to local disk on failure.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'minio' | 'local' | 'auto';
  private readonly bucket: string;
  private readonly localDir: string;
  private client: Minio.Client | null = null;
  private minioHealthy: boolean | null = null;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<'minio' | 'local' | 'auto'>(
      'STORAGE_DRIVER',
      'auto',
    ) as 'minio' | 'local' | 'auto';
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'talentshowcase');
    this.localDir = this.config.get<string>(
      'STORAGE_LOCAL_DIR',
      path.resolve(process.cwd(), '../../.storage'),
    );

    if (this.driver !== 'local') {
      const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
      const port = parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10);
      this.client = new Minio.Client({
        endPoint: endpoint,
        port,
        useSSL: this.config.get('MINIO_USE_SSL', 'false') === 'true',
        accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
        secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      });
    }

    fs.mkdirSync(this.localDir, { recursive: true });
  }

  /** Current active driver, useful for the health endpoint. */
  get activeDriver(): 'minio' | 'local' {
    if (this.driver === 'local') return 'local';
    if (this.driver === 'minio') return this.minioHealthy === false ? 'local' : 'minio';
    return this.minioHealthy ? 'minio' : 'local';
  }

  async put(key: string, body: Buffer, contentType = 'application/octet-stream'): Promise<void> {
    if (await this.useMinio()) {
      await this.client!.putObject(this.bucket, key, body, body.length, {
        'Content-Type': contentType,
      });
      return;
    }
    const file = this.localPath(key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }

  async get(key: string): Promise<Buffer> {
    if (await this.useMinio()) {
      const stream = await this.client!.getObject(this.bucket, key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks);
    }
    const file = this.localPath(key);
    if (!fs.existsSync(file)) {
      throw new ServiceUnavailableException('Object not found in storage');
    }
    return fs.readFileSync(file);
  }

  async remove(key: string): Promise<void> {
    if (await this.useMinio()) {
      await this.client!.removeObject(this.bucket, key);
      return;
    }
    const file = this.localPath(key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  async healthy(): Promise<boolean> {
    if (this.driver === 'local') return true;
    try {
      await this.useMinio();
      return true;
    } catch {
      return false;
    }
  }

  private localPath(key: string): string {
    // Prevent path traversal: keys must stay inside localDir
    const safe = key.replace(/\.\./g, '_');
    return path.join(this.localDir, safe);
  }

  private async useMinio(): Promise<boolean> {
    if (this.driver === 'local') return false;

    if (this.minioHealthy === null) {
      // First probe: check bucket existence, creating it if needed.
      try {
        const exists = await this.client!.bucketExists(this.bucket);
        if (!exists) {
          await this.client!.makeBucket(this.bucket, 'us-east-1');
          this.logger.log(`Created MinIO bucket "${this.bucket}"`);
        }
        this.minioHealthy = true;
        this.logger.log('Storage driver: minio');
      } catch (err) {
        this.minioHealthy = false;
        this.logger.warn(
          `MinIO unreachable (${(err as Error).message}); falling back to local disk storage`,
        );
      }
    }

    if (!this.minioHealthy) {
      if (this.driver === 'minio') {
        throw new ServiceUnavailableException('MinIO unavailable and local fallback disabled');
      }
      return false; // auto mode with minio down -> local disk
    }
    return true;
  }
}
