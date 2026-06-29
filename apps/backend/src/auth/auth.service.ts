import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DRIZZLE } from '../db/drizzle.module';
import type { Database } from '../db/drizzle';
import * as s from '../db/schema';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const [user] = await this.db
      .select()
      .from(s.users)
      .where(eq(s.users.email, email.toLowerCase().trim()));

    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
    if (!user.approved) {
      throw new UnauthorizedException('PENDING_APPROVAL');
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Credenciales incorrectas');

    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });

    await this.db
      .update(s.users)
      .set({ lastActiveAt: new Date() })
      .where(eq(s.users.id, user.id));

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        forcePasswordChange: user.forcePasswordChange,
      },
    };
  }

  async me(userId: number) {
    const [user] = await this.db
      .select({
        id: s.users.id,
        email: s.users.email,
        role: s.users.role,
        forcePasswordChange: s.users.forcePasswordChange,
      })
      .from(s.users)
      .where(eq(s.users.id, userId));

    if (!user) throw new UnauthorizedException();
    return user;
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const [user] = await this.db.select().from(s.users).where(eq(s.users.id, userId));
    if (!user) throw new UnauthorizedException();

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new BadRequestException('La contraseña actual es incorrecta');

    if (newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.db
      .update(s.users)
      .set({ passwordHash: hash, forcePasswordChange: false })
      .where(eq(s.users.id, userId));

    return { ok: true };
  }

  async requestReset(email: string) {
    // Always return ok to not leak whether the email exists
    const [user] = await this.db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.email, email.toLowerCase().trim()));

    if (!user) return { ok: true };

    // Invalidate old tokens for this user
    await this.db
      .delete(s.passwordResetTokens)
      .where(eq(s.passwordResetTokens.userId, user.id));

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.db.insert(s.passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5290';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    void this.email.sendPasswordResetEmail({ email, resetUrl });

    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    const [row] = await this.db
      .select()
      .from(s.passwordResetTokens)
      .where(eq(s.passwordResetTokens.token, token));

    if (!row) throw new BadRequestException('Token inválido o expirado');
    if (row.usedAt) throw new BadRequestException('Este enlace ya ha sido usado');
    if (new Date() > row.expiresAt) throw new BadRequestException('El enlace ha expirado');

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.db.transaction(async (tx) => {
      await tx
        .update(s.users)
        .set({ passwordHash: hash, forcePasswordChange: false })
        .where(eq(s.users.id, row.userId));
      await tx
        .update(s.passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(s.passwordResetTokens.id, row.id));
    });

    return { ok: true };
  }

  async requestAccess(name: string, email: string, reason: string) {
    const normalizedEmail = email.toLowerCase().trim();

    // Check existing user
    const [existingUser] = await this.db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.email, normalizedEmail));

    if (existingUser) {
      // Silent success — don't reveal that the email already exists
      return { ok: true };
    }

    // Check pending request (allow resubmission if rejected)
    const [pendingReq] = await this.db
      .select({ id: s.accessRequests.id })
      .from(s.accessRequests)
      .where(eq(s.accessRequests.email, normalizedEmail));

    if (pendingReq) {
      return { ok: true };
    }

    await this.db.insert(s.accessRequests).values({
      name: name.trim(),
      email: normalizedEmail,
      reason: reason.trim(),
    });

    void this.email.sendAccessRequestNotification({ name, email: normalizedEmail, reason });

    return { ok: true };
  }

  // Used by AppModule bootstrap to seed the admin user
  async ensureAdminExists(email: string, password: string) {
    const [existing] = await this.db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.email, email.toLowerCase()));

    if (existing) return;

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.db.insert(s.users).values({
      email: email.toLowerCase(),
      passwordHash: hash,
      role: 'admin',
      approved: true,
      forcePasswordChange: false,
    });
    this.logger.log(`Admin user created: ${email}`);
  }

  // Used by AdminService to create beta users
  async createUser(email: string, temporaryPassword: string) {
    const existing = await this.db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.email, email.toLowerCase()));

    if (existing.length > 0) throw new ConflictException('El email ya está registrado');

    const hash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const [user] = await this.db
      .insert(s.users)
      .values({
        email: email.toLowerCase(),
        passwordHash: hash,
        role: 'beta',
        approved: true,
        forcePasswordChange: true,
      })
      .returning({ id: s.users.id });

    return user;
  }
}
