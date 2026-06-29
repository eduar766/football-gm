import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../db/drizzle.module';
import type { Database } from '../db/drizzle';
import * as s from '../db/schema';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  forcePasswordChange: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const [user] = await this.db
      .select({
        id: s.users.id,
        email: s.users.email,
        role: s.users.role,
        approved: s.users.approved,
        forcePasswordChange: s.users.forcePasswordChange,
      })
      .from(s.users)
      .where(eq(s.users.id, payload.sub));

    if (!user || !user.approved) throw new UnauthorizedException();

    // Update lastActiveAt without awaiting (fire-and-forget)
    void this.db
      .update(s.users)
      .set({ lastActiveAt: new Date() })
      .where(eq(s.users.id, user.id));

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      forcePasswordChange: user.forcePasswordChange,
    };
  }
}
