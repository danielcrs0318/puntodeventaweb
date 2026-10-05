import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { randomUUID } from 'crypto'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request & { user?: { id?: number } }>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null

    const rawMessage =
      exceptionResponse
        ? typeof exceptionResponse === 'object'
          ? (exceptionResponse as Record<string, unknown>).message ?? exceptionResponse
          : exceptionResponse
        : 'Error interno del servidor'

    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage)
    const suppliedId = request.headers['x-request-id']
    const requestId = typeof suppliedId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(suppliedId)
      ? suppliedId
      : randomUUID()
    response.setHeader('X-Request-Id', requestId)
    const userId = request.user?.id

    const logContext = {
      requestId,
      method: request.method,
      path: request.path,
      status,
      userId,
      message,
    }

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.path} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
        JSON.stringify(logContext),
      )
    } else if (status >= 400) {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.path} -> ${status}: ${message}`,
        JSON.stringify(logContext),
      )
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      requestId,
      message,
      ...(process.env.NODE_ENV !== 'production' && exception instanceof Error && status >= 500
        ? { detail: exception.message }
        : {}),
    })
  }
}
