import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 5 login attempts per 15 minutes per IP — brute force protection.
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: AuthUser }) {
    return this.auth.me(req.user.id);
  }

  @Post('logout')
  logout() {
    // Stateless — client discards the token
    return { ok: true };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Req() req: { user: AuthUser },
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.auth.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  // 3 requests per day — prevents Resend quota drain and inbox spam.
  @Post('request-access')
  @Throttle({ default: { limit: 3, ttl: 86_400_000 } })
  requestAccess(@Body() body: { name: string; email: string; reason: string }) {
    return this.auth.requestAccess(body.name, body.email, body.reason);
  }

  // 3 resets per hour per IP.
  @Post('request-reset')
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  requestReset(@Body() body: { email: string }) {
    return this.auth.requestReset(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.auth.resetPassword(body.token, body.newPassword);
  }
}
