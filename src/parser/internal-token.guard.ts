import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-token'];
    const expected = this.config.get<string>('INTERNAL_INGEST_TOKEN');
    if (!expected || provided !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return true;
  }
}
