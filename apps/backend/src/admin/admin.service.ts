import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import { DRIZZLE } from '../db/drizzle.module';
import type { Database } from '../db/drizzle';
import * as s from '../db/schema';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  async getRequests() {
    const rows = await this.db
      .select()
      .from(s.accessRequests)
      .orderBy(s.accessRequests.requestedAt);

    const pending = rows.filter((r) => r.status === 'pending');
    const reviewed = rows.filter((r) => r.status !== 'pending');
    return { pending, reviewed };
  }

  async approveRequest(requestId: number, adminUserId: number, temporaryPassword: string) {
    const [req] = await this.db
      .select()
      .from(s.accessRequests)
      .where(eq(s.accessRequests.id, requestId));

    if (!req) throw new NotFoundException('Solicitud no encontrada');
    if (req.status !== 'pending') throw new BadRequestException('Esta solicitud ya fue revisada');

    const user = await this.authService.createUser(req.email, temporaryPassword);

    await this.db
      .update(s.accessRequests)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
      })
      .where(eq(s.accessRequests.id, requestId));

    await this.emailService.sendApprovalEmail({
      name: req.name,
      email: req.email,
      temporaryPassword,
    });

    return { userId: user.id };
  }

  async rejectRequest(requestId: number, adminUserId: number, reason?: string) {
    const [req] = await this.db
      .select()
      .from(s.accessRequests)
      .where(eq(s.accessRequests.id, requestId));

    if (!req) throw new NotFoundException('Solicitud no encontrada');
    if (req.status !== 'pending') throw new BadRequestException('Esta solicitud ya fue revisada');

    await this.db
      .update(s.accessRequests)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
      })
      .where(eq(s.accessRequests.id, requestId));

    await this.emailService.sendRejectionEmail({ name: req.name, email: req.email, reason });

    return { ok: true };
  }

  async getUsers() {
    const rows = await this.db
      .select({
        id: s.users.id,
        email: s.users.email,
        role: s.users.role,
        approved: s.users.approved,
        createdAt: s.users.createdAt,
        lastActiveAt: s.users.lastActiveAt,
        gameCount: sql<number>`cast(count(${s.games.id}) as int)`,
      })
      .from(s.users)
      .leftJoin(s.games, eq(s.games.userId, s.users.id))
      .groupBy(s.users.id)
      .orderBy(s.users.createdAt);

    return rows;
  }

  async revokeUser(targetId: number, adminId: number) {
    if (targetId === adminId) {
      throw new ForbiddenException('No puedes revocar tu propio acceso');
    }
    await this.db
      .update(s.users)
      .set({ approved: false })
      .where(eq(s.users.id, targetId));
    return { ok: true };
  }

  async restoreUser(targetId: number) {
    await this.db
      .update(s.users)
      .set({ approved: true })
      .where(eq(s.users.id, targetId));
    return { ok: true };
  }

  generateTemporaryPassword(): string {
    return crypto.randomBytes(6).toString('base64url');
  }
}
