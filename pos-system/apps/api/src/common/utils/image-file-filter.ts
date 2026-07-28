import { BadRequestException } from '@nestjs/common'

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function imageFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!IMAGE_MIME.has(file.mimetype)) {
    return cb(new BadRequestException('Solo se permiten imágenes (JPEG, PNG, WebP, GIF)'), false)
  }
  cb(null, true)
}
