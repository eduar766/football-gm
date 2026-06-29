# Plan Beta — Acceso controlado, auth y UX de lanzamiento

> El juego funciona. Es hora de que otros lo jueguen contigo de forma controlada.
> Esta fase convierte una app local single-user en una plataforma beta multi-usuario
> con control total de acceso, sin perder un solo día de desarrollo en infraestructura
> innecesaria.

---

## Diagnóstico del estado actual

- **No hay auth**: cualquiera que tenga la URL puede crear juegos y llamar endpoints.
- **Games no tienen dueño**: la tabla `games` no tiene `userId`.
- **Un solo frontend sin rutas protegidas**: no hay login, no hay sesión.
- **CORS abierto** (`app.enableCors()` sin restricción de origen).

---

## Principios de diseño de esta fase

1. **Simple beats perfect**: JWT en localStorage (no httpOnly cookie) porque es una
   beta con usuarios de confianza, no un banco. Añadir httpOnly en producción cuando escale.
2. **Admin = usuario especial**: el admin es un usuario con `role = 'admin'` en DB.
   Se crea automáticamente al arrancar el backend si no existe (seed via env vars).
   No hay endpoint público para crear admins.
3. **Un solo módulo de email**: Resend. API key en env var. Un wrapper simple,
   no un sistema de templates complejos — solo 3 emails distintos para toda la beta.
4. **Sin OAuth por ahora**: email/contraseña con bcrypt. OAuth sería una sesión más
   y más deps. Añadir si la gente lo pide.
5. **El juego protege sus propios datos**: cada endpoint de `/games` verifica que
   `game.userId === req.user.id` OR `req.user.role === 'admin'`.

---

## Arquitectura post-beta

```
apps/backend/src/
  auth/
    auth.module.ts          nuevo
    auth.controller.ts      nuevo  (login, refresh, logout, me, request-access, reset-password)
    auth.service.ts         nuevo
    jwt.strategy.ts         nuevo
    jwt-auth.guard.ts       nuevo
    admin.guard.ts          nuevo
  admin/
    admin.module.ts         nuevo
    admin.controller.ts     nuevo  (GET/PATCH requests, GET/DELETE users)
    admin.service.ts        nuevo
  email/
    email.module.ts         nuevo
    email.service.ts        nuevo  (Resend wrapper — 3 métodos)
  game/
    game.controller.ts      modificado (añadir @UseGuards, ownership checks, delete)
    game.service.ts         modificado (createGame con userId, limit check, deleteGame)

apps/frontend/src/
  contexts/
    AuthContext.tsx          nuevo  (token, user, login, logout, refresh)
  routes/
    LoginPage.tsx            nuevo
    RequestAccessPage.tsx    nuevo
    AdminPage.tsx            nuevo
  components/
    BugReportBanner.tsx      nuevo
    GameLimitWarning.tsx     nuevo
    ChangelogModal.tsx       nuevo
    FirstLoginModal.tsx      nuevo
  router.tsx                 modificado (rutas protegidas, /login, /admin)
  api.ts                     modificado (auth header en todas las peticiones)
```

---

## Batch Beta.1 — Fundación: auth + ownership + límite de juegos

**Objetivo:** El backend es seguro. Nadie puede acceder a juegos ajenos.
El frontend tiene login. El admin puede entrar.

### DB — nuevas tablas (migración Drizzle)

```typescript
// users
export const userRole = pgEnum('user_role', ['admin', 'beta']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('beta'),
  approved: boolean('approved').notNull().default(false),
  forcePasswordChange: boolean('force_password_change').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
});

// games — añadir FK a users
// games.userId: integer FK → users.id, nullable durante migración
// NOTA: games existentes quedan userId = NULL → solo accesibles por admin
```

**Migración en 2 pasos:**
1. `ALTER TABLE games ADD COLUMN user_id integer REFERENCES users(id)` (nullable)
2. No se toca data existente — el admin verá esas partidas "huérfanas" en su panel.

### Backend — Auth module

**`POST /auth/login`**
```typescript
body: { email: string; password: string }
→ { accessToken: string; user: { id, email, role, forcePasswordChange } }
```
- Verifica `user.approved === true` antes de emitir token (401 si no).
- JWT payload: `{ sub: userId, email, role }`.
- Expiración: **7 días** (beta — no queremos que la gente pierda sesión cada 15min
  mientras prueba el juego, eso frustra; ajustar en producción).

**`GET /auth/me`** — requiere JWT
```typescript
→ { id, email, role, forcePasswordChange }
```

**`POST /auth/logout`** — stateless (el cliente borra el token; este endpoint
existe para el flujo UX limpio).

**`POST /auth/change-password`** — requiere JWT
```typescript
body: { currentPassword: string; newPassword: string }
```
- Si `forcePasswordChange = true`, setea a `false` tras el cambio.
- Validación: mínimo 8 chars.

**`POST /auth/request-reset`** — público
```typescript
body: { email: string }
→ { ok: true }  // siempre 200 (no revelar si el email existe)
```
- Genera token aleatorio (`crypto.randomBytes(32).toString('hex')`).
- Guarda en tabla `password_reset_tokens` (expira en 1 hora).
- Envía email con link: `https://tuapp.com/reset-password?token=...`

**`POST /auth/reset-password`** — público
```typescript
body: { token: string; newPassword: string }
```
- Valida token (existe, no usado, no expirado).
- Marca token como usado, actualiza hash.

### DB — password_reset_tokens

```typescript
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});
```

### Backend — JWT Strategy (Passport)

```typescript
// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }
  async validate(payload: { sub: number; email: string; role: string }) {
    // También actualiza lastActiveAt del usuario
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

### Backend — Guard global en GameController

Añadir `@UseGuards(JwtAuthGuard)` al `@Controller('games')` completo.
Excepciones: ninguna (importar el game requiere login).

**Ownership check** — helper en GameService:
```typescript
private assertOwner(game: { userId: number | null }, userId: number, role: string) {
  if (role === 'admin') return; // admin ve todo
  if (game.userId !== userId) throw new ForbiddenException();
}
```
Llamar en `getSummary`, `getStandings`, `closeSeason`, etc. — cualquier endpoint
que reciba un `gameId`.

### Backend — Límite de 3 juegos

En `createGame`:
```typescript
const count = await tx.select({ c: count() })
  .from(s.games)
  .where(and(eq(s.games.userId, userId), isNotNull(s.games.userId)));
if (count[0].c >= 3 && role !== 'admin') {
  throw new BadRequestException('GAME_LIMIT_REACHED');
}
```

### Backend — DELETE /games/:id (nuevo endpoint)

```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard)
async deleteGame(@Param('id', ParseIntPipe) id: number, @Req() req) {
  return this.games.deleteGame(id, req.user);
}
```

`deleteGame` en service:
- Verifica ownership.
- Elimina en cascada: `game_engine_states`, luego `games` (FK cascade en schema).
- Devuelve `{ ok: true }`.

**Schema**: añadir `onDelete: 'cascade'` a todas las FK que referencian `games.id`.
(Actualmente no tienen cascade — hay que añadirlo en la migración.)

### Backend — Admin seed al arrancar

En `AppModule.onApplicationBootstrap()`:
```typescript
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const exists = await db.select().from(users).where(eq(users.email, adminEmail));
  if (exists.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await db.insert(users).values({
      email: adminEmail,
      passwordHash: hash,
      role: 'admin',
      approved: true,
      forcePasswordChange: false,
    });
  }
}
```

### Frontend — AuthContext

```typescript
// contexts/AuthContext.tsx
interface AuthState {
  token: string | null;       // JWT en localStorage
  user: { id: number; email: string; role: string; forcePasswordChange: boolean } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}
```

- Al montar: lee token de `localStorage`, llama `GET /auth/me` para validar.
- Si `me` falla (401): borra token, redirige a `/login`.
- `login()`: POST /auth/login → guarda token → redirige a `/`.
- `logout()`: borra token → redirige a `/login`.

**ProtectedRoute** component:
```typescript
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" />;
  if (user.forcePasswordChange) return <Navigate to="/change-password" />;
  return children;
}
```

### Frontend — Páginas nuevas (Beta.1)

**`/login`** — LoginPage.tsx
- Form: email + contraseña + botón "Entrar"
- Link "¿No tienes acceso? → Solicitar acceso"
- Link "¿Olvidaste tu contraseña?"
- Error: "Cuenta pendiente de aprobación" si el backend devuelve 401 con code específico.

**`/change-password`** — ChangePasswordPage.tsx
- Obligatoria si `forcePasswordChange === true`
- Form: contraseña actual + nueva + confirmar
- Tras éxito: redirige al juego

**`/reset-password`** — ResetPasswordPage.tsx
- Recibe `?token=...` de la URL
- Form: nueva contraseña + confirmar
- Mensajes claros: token inválido / expirado / éxito

### Frontend — api.ts

Añadir auth header automático:
```typescript
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('fgm_token');
  const res = await fetch(`${API}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  if (res.status === 401) {
    localStorage.removeItem('fgm_token');
    window.location.href = '/login';  // hard redirect para limpiar estado
    throw new Error('Unauthorized');
  }
  // ... resto
}
```

### Frontend — GamesPage: límite visible

- Contador "2/3 juegos activos" visible en header de la página.
- Si count === 3: botón "Nueva partida" deshabilitado + tooltip "Límite alcanzado".
- Cada juego tiene botón "🗑 Eliminar" con modal de confirmación:
  > "¿Seguro? Esta acción es permanente. **Descarga tu partida** antes de borrarla si quieres conservarla."
  > Botón: [Cancelar] [Exportar primero] [Eliminar de todas formas]

### Variables de entorno — Beta.1

```bash
# apps/backend/.env
JWT_SECRET=<random 64-char string>   # genera con: openssl rand -hex 32
ADMIN_EMAIL=eduar766@gmail.com
ADMIN_PASSWORD=<tu contraseña>
```

### Paquetes NPM a instalar (backend)

```bash
pnpm --filter @football-gm/backend add @nestjs/passport @nestjs/jwt passport passport-jwt passport-local bcrypt
pnpm --filter @football-gm/backend add -D @types/passport-jwt @types/passport-local @types/bcrypt
```

### Archivos — Beta.1

| Archivo | Acción |
|---------|--------|
| `apps/backend/src/db/schema.ts` | Añadir `users`, `userRole`, `passwordResetTokens`; añadir `userId` a `games`; añadir `onDelete: 'cascade'` a FKs |
| `apps/backend/src/auth/auth.module.ts` | Nuevo |
| `apps/backend/src/auth/auth.controller.ts` | Nuevo |
| `apps/backend/src/auth/auth.service.ts` | Nuevo |
| `apps/backend/src/auth/jwt.strategy.ts` | Nuevo |
| `apps/backend/src/auth/jwt-auth.guard.ts` | Nuevo |
| `apps/backend/src/app.module.ts` | Importar AuthModule; añadir bootstrap hook para admin seed |
| `apps/backend/src/game/game.controller.ts` | Añadir `@UseGuards(JwtAuthGuard)`, `@Req()`, endpoint DELETE |
| `apps/backend/src/game/game.service.ts` | `createGame(userId)`, `deleteGame()`, `assertOwner()`, limit check |
| `apps/frontend/src/contexts/AuthContext.tsx` | Nuevo |
| `apps/frontend/src/routes/LoginPage.tsx` | Nuevo |
| `apps/frontend/src/routes/ChangePasswordPage.tsx` | Nuevo |
| `apps/frontend/src/routes/ResetPasswordPage.tsx` | Nuevo |
| `apps/frontend/src/api.ts` | Auth header, 401 handler |
| `apps/frontend/src/router.tsx` | Rutas protegidas, /login, /change-password, /reset-password |
| `apps/frontend/src/routes/GamesPage.tsx` | Límite de juegos, botón eliminar, modal confirmación |

---

## Batch Beta.2 — Request access + Panel admin + Emails

**Objetivo:** El flujo completo de onboarding funciona. Alguien llega a la web,
solicita acceso, tú lo apruebas, le llega el email con contraseña temporal, entra.

### DB — access_requests

```typescript
export const accessRequestStatus = pgEnum('access_request_status', [
  'pending', 'approved', 'rejected',
]);

export const accessRequests = pgTable('access_requests', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  reason: text('reason').notNull(),
  status: accessRequestStatus('status').notNull().default('pending'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id),
});
```

### Backend — Auth endpoints de solicitud

**`POST /auth/request-access`** — público
```typescript
body: { name: string; email: string; reason: string }
→ { ok: true }
```
- Valida que el email no esté ya registrado ni tenga solicitud pendiente.
- Inserta en `access_requests`.
- Llama `EmailService.sendAccessRequestNotification({ name, email, reason })` → te llega a ti.
- Siempre devuelve 200 (no revelar si el email ya existe en sistema).

### Backend — Admin module

**Guards:**
```typescript
// admin.guard.ts
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    return user?.role === 'admin';
  }
}
```

**`GET /admin/requests`** — requiere JwtAuthGuard + AdminGuard
```typescript
→ { pending: AccessRequestDto[], reviewed: AccessRequestDto[] }
```

**`POST /admin/requests/:id/approve`** — requiere admin
```typescript
body: { temporaryPassword: string }  // o el backend genera una aleatoria
```
- Crea usuario en tabla `users` con `approved: true`, `forcePasswordChange: true`.
- Actualiza `access_requests.status = 'approved'`.
- Llama `EmailService.sendApprovalEmail({ name, email, temporaryPassword })`.
- Devuelve `{ userId: number }`.

**`POST /admin/requests/:id/reject`** — requiere admin
```typescript
body: { reason?: string }
```
- Actualiza `access_requests.status = 'rejected'`.
- Llama `EmailService.sendRejectionEmail({ name, email, reason })`.

**`GET /admin/users`** — requiere admin
```typescript
→ UserAdminDto[]  // { id, email, role, approved, createdAt, lastActiveAt, gameCount }
```
- JOIN con `games` para contar juegos activos.

**`DELETE /admin/users/:id`** — requiere admin
- Revoca acceso: `approved = false`. No borra el usuario (conserva historial).
- Si el userId es el del admin que hace la petición: 400 (no puedes borrarte a ti mismo).

**`POST /admin/users/:id/restore`** — requiere admin
- Reactiva un usuario revocado: `approved = true`.

### Email service — 3 templates (Resend)

Paquete: `pnpm --filter @football-gm/backend add resend`

```typescript
// email.service.ts
@Injectable()
export class EmailService {
  private resend = new Resend(process.env.RESEND_API_KEY);
  private FROM = 'Football GM <noreply@tudominio.com>';
  private ADMIN = process.env.ADMIN_EMAIL!;
  private APP_URL = process.env.APP_URL ?? 'http://localhost:5290';

  // 1. Te llega a ti cuando alguien solicita acceso
  async sendAccessRequestNotification(data: { name: string; email: string; reason: string }) {
    await this.resend.emails.send({
      from: this.FROM,
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

  // 2. Le llega al usuario cuando apruebas su solicitud
  async sendApprovalEmail(data: { name: string; email: string; temporaryPassword: string }) {
    await this.resend.emails.send({
      from: this.FROM,
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

  // 3. Le llega al usuario cuando rechazas su solicitud
  async sendRejectionEmail(data: { name: string; email: string; reason?: string }) {
    await this.resend.emails.send({
      from: this.FROM,
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

  // 4. Reset de contraseña
  async sendPasswordResetEmail(data: { email: string; resetUrl: string }) {
    await this.resend.emails.send({
      from: this.FROM,
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
```

### Frontend — AdminPage.tsx

Ruta: `/admin` — solo accesible con `role === 'admin'`.

**Layout:** tabs horizontales — "Solicitudes" / "Usuarios"

**Tab Solicitudes:**
- Lista de solicitudes pendientes: nombre, email, motivo, fecha, botones [Aprobar] [Rechazar]
- Al aprobar: modal que genera contraseña temporal aleatoria (o permite editarla) + confirmar.
  La contraseña generada se muestra UNA VEZ en el modal (el admin la copia si quiere).
  Se envía el email automáticamente.
- Al rechazar: modal con campo opcional "Motivo del rechazo" + confirmar.
- Lista colapsable de solicitudes ya revisadas (con estado Aprobado/Rechazado).

**Tab Usuarios:**
- Tabla: email, rol, estado (activo/revocado), último acceso, juegos activos, acciones.
- Botón "Revocar acceso" (con confirmación) o "Restaurar acceso".
- No hay botón de crear usuario manualmente — se hace siempre via solicitud para
  mantener el flujo coherente. (Si necesitas crear un usuario sin solicitud, lo haces
  directamente en el panel con un modal "Crear usuario" — añadir si hace falta.)

### Frontend — RequestAccessPage.tsx

Ruta: `/request-access` — pública.

- Form: nombre completo, email, textarea "¿Por qué quieres participar en la beta?"
  (max 300 chars, contador de caracteres).
- Submit → 200: pantalla de confirmación "Solicitud enviada — te avisaremos por email".
- Validación inline: email válido, nombre no vacío, motivo mínimo 20 chars.
- Link: "¿Ya tienes cuenta? → Iniciar sesión"

### Variables de entorno — Beta.2

```bash
# apps/backend/.env
RESEND_API_KEY=re_xxxxxxxxxxxx
APP_URL=https://tudominio.com   # o http://localhost:5290 en dev
```

### Archivos — Beta.2

| Archivo | Acción |
|---------|--------|
| `apps/backend/src/db/schema.ts` | Añadir `accessRequests`, `accessRequestStatus` |
| `apps/backend/src/email/email.module.ts` | Nuevo |
| `apps/backend/src/email/email.service.ts` | Nuevo |
| `apps/backend/src/admin/admin.module.ts` | Nuevo |
| `apps/backend/src/admin/admin.controller.ts` | Nuevo |
| `apps/backend/src/admin/admin.service.ts` | Nuevo |
| `apps/backend/src/auth/admin.guard.ts` | Nuevo |
| `apps/backend/src/auth/auth.controller.ts` | Añadir `POST /request-access` |
| `apps/backend/src/auth/auth.service.ts` | Añadir lógica de request-access |
| `apps/backend/src/app.module.ts` | Importar AdminModule, EmailModule |
| `apps/frontend/src/routes/AdminPage.tsx` | Nuevo |
| `apps/frontend/src/routes/RequestAccessPage.tsx` | Nuevo |
| `apps/frontend/src/router.tsx` | Rutas /admin, /request-access |
| `apps/frontend/src/api.ts` | Endpoints de admin y request-access |

---

## Batch Beta.3 — UX de beta: banner, onboarding, changelog

**Objetivo:** Los primeros usuarios tienen contexto de que es una beta, saben
cómo reportar bugs, y no se sienten abandonados cuando encuentran algo raro.

### BugReportBanner.tsx

Componente flotante fijo en **esquina inferior derecha** de toda la app (dentro de GameLayout
y en GamesPage — siempre visible para usuarios logueados).

**Diseño:**
```
[🐛 Bug] [💡 Idea]
```
Dos botones pequeños (Mantine `ActionIcon` con tooltip), siempre visibles.
- Al hacer clic en 🐛 → abre `https://github.com/{OWNER}/{REPO}/issues/new?labels=bug&template=bug_report.md`
  en nueva pestaña.
- Al hacer clic en 💡 → abre `https://github.com/{OWNER}/{REPO}/issues/new?labels=enhancement&template=feature_request.md`

**Templates de GitHub Issues** (archivos a crear en `.github/`):
```markdown
# .github/ISSUE_TEMPLATE/bug_report.md
---
name: Bug report
about: Reporta algo que no funciona como debería
labels: bug
---

**¿Qué ocurrió?**


**¿Qué esperabas que ocurriera?**


**Pasos para reproducirlo:**
1. 
2. 

**Año del juego / fase (pretemporada / temporada):**

**Capturas de pantalla (si aplica):**
```

```markdown
# .github/ISSUE_TEMPLATE/feature_request.md
---
name: Sugerencia / Feature request
about: Algo que te gustaría ver en el juego
labels: enhancement
---

**¿Qué te gustaría que existiera?**


**¿Por qué sería útil?**


**¿Tienes alguna idea de cómo funcionaría?**
```

El banner tiene `position: fixed`, `bottom: 16px`, `right: 16px`, `zIndex: 200`.
Nunca se superpone con el sidebar porque está en la esquina opuesta.

### FirstLoginModal.tsx

Modal que aparece **una sola vez** al primer login exitoso.
Condición: `localStorage.getItem('fgm_onboarding_done') !== 'true'`.

**3 slides (Carousel de Mantine):**

1. **"Bienvenido a Football GM Beta"**
   - Eres el comisionado, no el entrenador.
   - Tu trabajo: hacer crecer la liga, atraer equipos, organizar competiciones.
   - [→ Siguiente]

2. **"Cómo empezar"**
   - Arranca la pretemporada con "Iniciar temporada".
   - Avanza jornada a jornada o usa "Avanzar temporada" para saltar.
   - Usa impulsos para influir en partidos (limitados por temporada).
   - [← Anterior] [→ Siguiente]

3. **"Estamos en beta"**
   - Puedes encontrar bugs — usa el botón 🐛 para reportarlos.
   - Exporta tu partida regularmente (Partidas → Exportar) por si acaso.
   - Tu feedback construye el juego.
   - [← Anterior] [Empezar a jugar]

Al cerrar: `localStorage.setItem('fgm_onboarding_done', 'true')`.

### ChangelogModal.tsx / ChangelogPage

**Opción A (simple):** Un modal accesible desde un link "Novedades" en el sidebar.
**Opción B (inline):** Pequeña sección en GamesPage con las últimas 3 entradas.

Implementar **Opción A** — link en sidebar que abre modal:

```typescript
// src/changelog.ts — actualizar manualmente con cada release
export const CHANGELOG = [
  {
    version: 'Beta 0.1',
    date: '2026-06',
    changes: [
      'Primera versión beta pública',
      'Simulación de ligas rivales con clasificaciones en vivo',
      'Copa inter-ligas para cada federación rival',
      'Fichajes internacionales: jugadores de ligas rivales a tu liga',
      'Historial de campeones de federaciones rivales',
      'Panel "Mundo" con todas las clasificaciones rivales en tiempo real',
    ],
  },
];
```

**En el sidebar:** link discreto "Novedades" con badge de versión actual.
Al clic: modal con lista de versiones y sus cambios.

### ExportReminderBanner.tsx

Banner amarillo no intrusivo en GamesPage cuando el usuario tiene juegos activos.
Texto: _"Recuerda exportar tus partidas regularmente — estamos en beta."_
Botón [×] para descartarlo. Reaparece cada 7 días (localStorage con timestamp).

### Badges y marcas de beta

- Header del sidebar: badge pequeño "BETA" junto al nombre de la federación
  (o en el logo). Color: amber. `variant="outline"`.
- `<title>` del HTML: "Football GM — Beta"
- Meta description actualizada en `index.html`.

### Archivos — Beta.3

| Archivo | Acción |
|---------|--------|
| `apps/frontend/src/components/BugReportBanner.tsx` | Nuevo |
| `apps/frontend/src/components/FirstLoginModal.tsx` | Nuevo |
| `apps/frontend/src/components/ChangelogModal.tsx` | Nuevo |
| `apps/frontend/src/components/ExportReminderBanner.tsx` | Nuevo |
| `apps/frontend/src/changelog.ts` | Nuevo — fuente de verdad del changelog |
| `apps/frontend/src/routes/GameLayout.tsx` | Añadir BugReportBanner, link Novedades |
| `apps/frontend/src/routes/GamesPage.tsx` | Añadir ExportReminderBanner |
| `apps/frontend/src/routes/LoginPage.tsx` | Disparar FirstLoginModal tras login |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Nuevo |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Nuevo |

---

## Contratos nuevos (packages/contracts)

```typescript
// Auth
export const LoginRequest = z.object({ email: z.string().email(), password: z.string() });
export const LoginResponse = z.object({
  accessToken: z.string(),
  user: z.object({ id: Id, email: z.string(), role: z.enum(['admin','beta']), forcePasswordChange: z.boolean() }),
});

export const RequestAccessRequest = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  reason: z.string().min(20).max(300),
});

export const ChangePasswordRequest = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export const ResetPasswordRequest = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

// Admin
export const AccessRequestDto = z.object({
  id: Id,
  name: z.string(),
  email: z.string(),
  reason: z.string(),
  status: z.enum(['pending','approved','rejected']),
  requestedAt: z.string(),
  reviewedAt: z.string().nullable(),
});

export const AdminUserDto = z.object({
  id: Id,
  email: z.string(),
  role: z.enum(['admin','beta']),
  approved: z.boolean(),
  createdAt: z.string(),
  lastActiveAt: z.string().nullable(),
  gameCount: z.number().int(),
});

export const ApproveRequestBody = z.object({ temporaryPassword: z.string().min(8) });
export const RejectRequestBody = z.object({ reason: z.string().optional() });

// Games (modificación)
// GameListItem ya existe — añadir:
export const GameListItemV2 = GameListItem.extend({
  userId: Id.nullable(),
});

// Añadir a GamesPage response
export const GamesPageResponse = z.object({
  games: z.array(GameListItem),
  activeCount: z.number().int(),
  limit: z.number().int(),
});
```

---

## Seguridad — checklist antes de abrir la beta

- [ ] `JWT_SECRET` de al menos 256 bits (64 chars hex) — nunca commitear al repo.
- [ ] `ADMIN_PASSWORD` fuerte (≥16 chars) — solo en `.env` que está en `.gitignore`.
- [ ] `.env` en `.gitignore` (ya debería estar, verificar).
- [ ] CORS restringido al dominio de producción en `main.ts`:
  ```typescript
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5290' });
  ```
- [ ] Rate limiting en endpoints de auth (evitar brute force):
  ```bash
  pnpm --filter @football-gm/backend add @nestjs/throttler
  ```
  Configurar: 10 intentos/minuto en `/auth/login`, 5/hora en `/auth/request-access`.
- [ ] Passwords hasheadas con bcrypt cost factor 12 (no 10 — un poco más lento pero más seguro).
- [ ] Token de reset de contraseña: nunca loggear, expiración dura (1 hora), uso único.
- [ ] Emails: verificar que el dominio de `from` está configurado en Resend (SPF/DKIM)
  o los emails caen en spam.
- [ ] Admin no puede borrarse a sí mismo.
- [ ] Límite de juegos enforced en backend (no solo frontend).

---

## Variables de entorno completas

```bash
# apps/backend/.env

# DB (ya existe)
DATABASE_URL=postgresql://postgres:postgres@localhost:5544/football_gm

# Auth
JWT_SECRET=<64 char hex — openssl rand -hex 32>

# Admin seed (bootstrap)
ADMIN_EMAIL=eduar766@gmail.com
ADMIN_PASSWORD=<contraseña fuerte>

# Email
RESEND_API_KEY=re_xxxxxxxxxxxx
APP_URL=http://localhost:5290   # en producción: https://tudominio.com

# CORS
CORS_ORIGIN=http://localhost:5290   # en producción: https://tudominio.com
```

---

## Secuencia de implementación recomendada

```
Beta.1 ── 2-3 días ──────────────────────────────────────────────────
  Día 1: Schema + migración + auth module completo (backend)
  Día 2: JwtGuard en GameController + ownership + límite + DELETE
  Día 3: Frontend AuthContext + LoginPage + router protegido

Beta.2 ── 2 días ────────────────────────────────────────────────────
  Día 4: EmailService + AccessRequests schema + endpoints admin/auth
  Día 5: AdminPage + RequestAccessPage en frontend

Beta.3 ── 1 día ─────────────────────────────────────────────────────
  Día 6: BugReportBanner + FirstLoginModal + Changelog + GitHub templates

Tests ── 0.5 día ────────────────────────────────────────────────────
  typecheck + tests manuales del flujo completo
  (solicitar acceso → aprobar → entrar → crear juego → llegar al límite → exportar → borrar)
```

---

## Flujo completo de usuario (happy path)

```
1. Usuario llega a la web → ve /login → clic "Solicitar acceso"
2. Rellena form → clic Enviar → pantalla de confirmación
3. Tú recibes email → abres /admin → ves la solicitud
4. Clic Aprobar → el sistema genera contraseña temporal → te la muestra (la copias si quieres)
5. Usuario recibe email con contraseña temporal → clic link → /login
6. Entra → FirstLoginModal (onboarding 3 slides) → forzado a cambiar contraseña
7. Llega a /games (lista vacía) → crea primer juego → juega
8. En cualquier momento: BugReportBanner disponible para reportar bugs
9. Si llega a 3 juegos: botón "Nueva partida" deshabilitado, mensaje claro
10. Para crear la 4ª: borra una → modal con opción de exportar primero
```
