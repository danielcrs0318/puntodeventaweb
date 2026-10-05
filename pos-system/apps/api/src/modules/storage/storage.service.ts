import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { promises as fs } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export type UploadFolder = 'products' | 'logos'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly s3: S3Client | null
  private readonly bucket: string | null
  private readonly publicBaseUrl: string | null
  private readonly uploadsDir: string

  constructor(private config: ConfigService) {
    this.uploadsDir = join(process.cwd(), 'uploads')
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim()
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim()
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim()
    const bucket = this.config.get<string>('R2_BUCKET_NAME')?.trim()
    const publicBaseUrl = this.config.get<string>('R2_PUBLIC_URL')?.trim()?.replace(/\/$/, '')
    const endpoint =
      this.config.get<string>('R2_ENDPOINT')?.trim() ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined)

    if (accountId && accessKeyId && secretAccessKey && bucket && publicBaseUrl && endpoint) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: false,
      })
      this.bucket = bucket
      this.publicBaseUrl = publicBaseUrl
      this.logger.log(`Almacenamiento de imágenes: Cloudflare R2 (bucket=${bucket})`)
    } else {
      this.s3 = null
      this.bucket = null
      this.publicBaseUrl = null
      this.logger.warn(
        'R2 no configurado — las imágenes se guardan en disco local (/uploads). En producción configura R2_*.',
      )
    }
  }

  get isR2Enabled(): boolean {
    return this.s3 !== null
  }

  async uploadImage(file: Express.Multer.File | undefined, folder: UploadFolder): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo')
    }
    if (!file.buffer && !file.path) {
      throw new BadRequestException('Archivo de imagen inválido')
    }

    const body = file.buffer ?? (await fs.readFile(file.path))
    const signatures: Record<string, { ext: string; valid: boolean }> = {
      'image/jpeg': { ext: '.jpg', valid: body.length >= 3 && body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
      'image/png': { ext: '.png', valid: body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
      'image/webp': { ext: '.webp', valid: body.length >= 12 && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP' },
      'image/gif': { ext: '.gif', valid: body.length >= 6 && ['GIF87a', 'GIF89a'].includes(body.toString('ascii', 0, 6)) },
    }
    const image = signatures[file.mimetype]
    if (!image?.valid) throw new BadRequestException('El contenido no corresponde a una imagen válida')
    const key = `${folder}/${uuidv4()}${image.ext}`
    const contentType = file.mimetype

    if (this.s3 && this.bucket && this.publicBaseUrl) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )
      // Limpia temp de multer disk si aplica
      if (file.path) await fs.unlink(file.path).catch(() => undefined)
      const url = `${this.publicBaseUrl}/${key}`
      return { url }
    }

    // Fallback local (desarrollo)
    await fs.mkdir(this.uploadsDir, { recursive: true })
    const filename = key.replace(`${folder}/`, '')
    const dest = join(this.uploadsDir, filename)
    await fs.writeFile(dest, body)
    if (file.path && file.path !== dest) await fs.unlink(file.path).catch(() => undefined)
    return { url: `/uploads/${filename}` }
  }

  /** Borra un objeto de R2 si la URL pertenece a nuestro public base. No falla el flujo si no existe. */
  async deleteByUrl(url?: string | null): Promise<void> {
    if (!url || !this.s3 || !this.bucket || !this.publicBaseUrl) return
    if (!url.startsWith(this.publicBaseUrl + '/')) return
    const key = url.slice(this.publicBaseUrl.length + 1)
    if (!key) return
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (err) {
      this.logger.warn(`No se pudo borrar ${key} de R2: ${err instanceof Error ? err.message : err}`)
    }
  }
}
