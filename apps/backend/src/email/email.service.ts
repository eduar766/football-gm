import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly FROM = 'Football GM <onboarding@resend.dev>';
  private readonly ADMIN: string;
  private readonly APP_URL: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.ADMIN = this.config.get<string>('ADMIN_EMAIL') ?? '';
    this.APP_URL = this.config.get<string>('APP_URL') ?? 'http://localhost:5290';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged but not sent');
    }
  }

  private async send(opts: { to: string; subject: string; html: string }) {
    if (!this.resend) {
      this.logger.log(`[Email dry-run] To: ${opts.to} | Subject: ${opts.subject}`);
      return;
    }
    try {
      await this.resend.emails.send({ from: this.FROM, ...opts });
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${String(err)}`);
    }
  }

  async sendAccessRequestNotification(data: { name: string; email: string; reason: string }) {
    await this.send({
      to: this.ADMIN,
      subject: `[Football GM] Nueva solicitud de acceso — ${data.name}`,
      html: `
        <h2>Nueva solicitud de acceso beta</h2>
        <p><b>Nombre:</b> ${data.name}</p>
        <p><b>Email:</b> ${data.email}</p>
        <p><b>Motivo:</b> ${data.reason}</p>
        <hr>
        <p><a href="${this.APP_URL}/admin">→ Revisar en el panel de admin</a></p>
      `,
    });
  }

  async sendApprovalEmail(data: { name: string; email: string; temporaryPassword: string }) {
    await this.send({
      to: data.email,
      subject: '¡Tu acceso a Football GM Beta ha sido aprobado!',
      html: `
        <h2>Bienvenido a Football GM Beta, ${data.name}</h2>
        <p>Tu solicitud de acceso ha sido aprobada.</p>
        <p><b>Email:</b> ${data.email}</p>
        <p><b>Contraseña temporal:</b> <code>${data.temporaryPassword}</code></p>
        <p>Al entrar por primera vez se te pedirá que cambies esta contraseña.</p>
        <p><a href="${this.APP_URL}/login">→ Acceder al juego</a></p>
        <hr>
        <p style="font-size:12px;color:#666">Esta es una beta. El juego puede tener bugs —
        usa el botón de reporte en la app para contárnoslos.</p>
      `,
    });
  }

  async sendRejectionEmail(data: { name: string; email: string; reason?: string }) {
    await this.send({
      to: data.email,
      subject: 'Actualización sobre tu solicitud a Football GM Beta',
      html: `
        <h2>Hola ${data.name},</h2>
        <p>Gracias por tu interés en Football GM Beta.</p>
        <p>Por el momento no podemos aprobar tu solicitud${data.reason ? `: ${data.reason}` : '.'}</p>
        <p>Seguiremos abriendo accesos progresivamente. Te avisaremos si cambia la situación.</p>
      `,
    });
  }

  async sendPasswordResetEmail(data: { email: string; resetUrl: string }) {
    await this.send({
      to: data.email,
      subject: 'Restablecer contraseña — Football GM',
      html: `
        <h2>Restablecer contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p><a href="${data.resetUrl}">→ Restablecer contraseña</a></p>
        <p>Este enlace expira en 1 hora. Si no solicitaste esto, ignora este email.</p>
      `,
    });
  }
}
