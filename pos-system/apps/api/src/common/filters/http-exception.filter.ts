import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'

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
    const requestId = (request.headers['x-request-id'] as string) ?? 'unknown'
    const userId = request.user?.id

    const logContext = {
      requestId,
      method: request.method,
      path: request.url,
      status,
      userId,
      message,
    }

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
        JSON.stringify(logContext),
      )
    } else if (status >= 400) {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} -> ${status}: ${message}`,
        JSON.stringify(logContext),
      )
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      message,
      ...(process.env.NODE_ENV !== 'production' && exception instanceof Error && status >= 500
        ? { detail: exception.message }
        : {}),
    })
  }
}
