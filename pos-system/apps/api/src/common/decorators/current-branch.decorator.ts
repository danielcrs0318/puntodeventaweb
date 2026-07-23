import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common'

export const CurrentBranchId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest()
  const branchId = req.branchId
  if (!branchId) {
    throw new BadRequestException('Sucursal no seleccionada. Envía el header X-Branch-Id.')
  }
  return branchId as number
})
