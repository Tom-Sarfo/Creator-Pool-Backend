import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const AccessToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    return "";
  }
);
