import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import { Request, Response } from 'express'
import { randomUUID } from 'crypto'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>()
    const res = context.switchToHttp().getResponse<Response>()
    const suppliedId = req.headers['x-request-id']
    const requestId = typeof suppliedId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(suppliedId)
      ? suppliedId
      : randomUUID()
    req.headers['x-request-id'] = requestId
    res.setHeader('X-Request-Id', requestId)

    const { method, path } = req
    const userId = (req as Request & { user?: { id?: number } }).user?.id
    const started = Date.now()

    this.logger.log(
      `[${requestId}] --> ${method} ${path}${userId ? ` user=${userId}` : ''}`,
    )

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started
          this.logger.log(
            `[${requestId}] <-- ${method} ${path} ${res.statusCode} ${ms}ms`,
          )
        },
        error: (err: Error) => {
          const ms = Date.now() - started
          this.logger.error(
            `[${requestId}] <-- ${method} ${path} ERROR ${ms}ms: ${err.message}`,
            err.stack,
          )
        },
      }),
    )
  }
}
