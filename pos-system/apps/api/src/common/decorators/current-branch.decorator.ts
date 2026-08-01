import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common'

export const CurrentBranchId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest()
  const branchId = req.branchId
  if (!branchId) {
    throw new BadRequestException(
      'Tu usuario no tiene una sucursal activa asignada. Pide al administrador que te asigne una sucursal.',
    )
  }
  return branchId as number
})
