import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'

@Injectable()
export class JwtAuthRestGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractTokenFromCookie(request)

    if (!token) {
      throw new UnauthorizedException('Token not found')
    }

    try {
      request['user'] = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      })
    } catch (e) {
      throw new UnauthorizedException(e)
    }

    return true
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies['access_token']
  }
}