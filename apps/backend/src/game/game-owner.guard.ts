import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/jwt.strategy';
import type { Database } from '../db/drizzle';
import { DRIZZLE } from '../db/drizzle.module';
import * as s from '../db/schema';

/**
 * Verifies that the authenticated user owns the game identified by :id in the
 * route params. Must run after JwtAuthGuard (needs req.user populated).
 *
 * Routes without :id (POST /games, GET /games, POST /games/import) are skipped
 * automatically. Admins bypass ownership checks.
 */
@Injectable()
export class GameOwnerGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user: AuthUser;
      params: Record<string, string>;
    }>();

    const rawId = req.params?.id;
    const gameId = rawId !== undefined ? Number(rawId) : NaN;

    // No :id in route (create, list, import) — nothing to check.
    if (!rawId || isNaN(gameId)) return true;

    // Admins can access any game.
    if (req.user?.role === 'admin') return true;

    const [game] = await this.db
      .select({ userId: s.games.userId })
      .from(s.games)
      .where(eq(s.games.id, gameId));

    if (!game) throw new NotFoundException(`Game ${gameId} not found`);
    if (game.userId !== req.user.id) throw new ForbiddenException();

    return true;
  }
}
