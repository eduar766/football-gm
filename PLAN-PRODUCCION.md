# PLAN-PRODUCCION.md

Plan de hardening y escalabilidad post-auditoría multidisciplinar.
Auditores: DB · Arquitectura · Frontend · Seguridad/DevOps.
Fecha: 2026-06-29.

---

## Resumen ejecutivo

El sistema tiene una base arquitectónica sólida (functional core / imperative shell, JSONB write-model, TanStack Query bien configurado), pero presenta **dos vulnerabilidades críticas explotables el día 1 con usuarios reales**, más un conjunto de problemas de escalabilidad que se harán insostenibles a partir de ~50 partidas concurrentes. El orden de ataque importa: primero seguridad, luego arquitectura (porque desestructurar el God Service facilita todo lo demás), luego DB y frontend.

---

## Fase 1 — Seguridad urgente (ANTES de cualquier usuario) ✅ COMPLETA

Estas tareas bloquean el lanzamiento. Ningún usuario beta puede entrar hasta resolverlas.

### ~~1.1 IDOR en endpoints de juego [CRÍTICO] · Esfuerzo M~~ ✅

**Problema:** `game.controller.ts` tiene ~50 endpoints que solo requieren login, no verifican que el juego pertenece al usuario. Cualquier beta autenticado puede leer y mutar la partida de otro incrementando el `id`.

**Solución:**
- Agregar `assertGameOwner(gameId, userId, tx)` en `game.service.ts` que haga `SELECT owner_id FROM games WHERE id = $1` dentro del mismo transaction context. Los admins bypasan.
- Llamarlo al inicio de TODOS los métodos del servicio que reciben `gameId` (el patrón `loadState` ya tiene `assertOwner` en lectura, extender a todos los que faltan).
- Alternativa más limpia: mover la verificación a `loadState()` directamente — si el usuario no es el owner, lanzar `ForbiddenException`. Centralizado, imposible olvidarlo en nuevos endpoints.

**Archivo clave:** `apps/backend/src/game/game.service.ts:99` — extender `loadState` para aceptar `userId` y verificar ownership en la misma query.

### ~~1.2 JWT secret fallback en código [CRÍTICO] · Esfuerzo S~~ ✅

**Problema:** `auth.module.ts:16` y `jwt.strategy.ts:36` usan `?? 'dev-secret-change-in-production'`. Si `JWT_SECRET` no está seteado en prod, el app arranca con un secreto público y cualquiera puede forjar tokens de admin.

**Solución:**
```ts
// En main.ts, antes de app.listen():
const secret = configService.get<string>('JWT_SECRET');
if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET must be set and >= 32 chars');
}
```
Eliminar los `?? 'dev-secret...'` de ambos archivos. Agregar `JWT_SECRET` al `.env.example` como requerido.

### ~~1.3 Rate limiting · Esfuerzo M~~ ✅

**Problema:** Sin `@nestjs/throttler`. `POST /auth/login` permite fuerza bruta ilimitada. `/auth/request-access` permite spam a Resend y la tabla `access_requests`.

**Solución:**
```bash
pnpm --filter @football-gm/backend add @nestjs/throttler
```
Global: 100 req/min/IP. Sobreescribir en auth:
- `POST /auth/login`: 5 intentos/15min/IP
- `POST /auth/request-reset`: 3/hora/IP
- `POST /auth/request-access`: 3/día/IP

### ~~1.4 CORS + Helmet · Esfuerzo S~~ ✅

**CORS:** `main.ts` — `app.enableCors()` abre todos los orígenes.
```ts
app.enableCors({ origin: process.env.FRONTEND_ORIGIN, credentials: true });
```

**Helmet:**
```ts
import helmet from 'helmet';
app.use(helmet());
```
Agregar `FRONTEND_ORIGIN` al `.env.example`.

### ~~1.5 Validación importGame · Esfuerzo M~~ ✅

**Problema:** `game.service.ts:1739-1763` hace `state as GameState` sin validar. Payload malformado se convierte en estado autoritativo.

**Solución:** Crear un schema Zod superficial en `contracts` que valide los campos raíz de `GameState` (sin validar recursivamente los 300 campos internos — solo que `year`, `rng`, `federations`, `teams`, etc. existen y tienen tipos correctos). Validar antes del INSERT. Agregar límite de tamaño en `main.ts` (`app.use(express.json({ limit: '5mb' }))`).

### ~~1.6 Zod en endpoints de auth · Esfuerzo S~~ ✅

`auth.controller.ts:17-55` usa `@Body() body: {...}` sin `ZodValidationPipe`. Agregar schemas en `packages/contracts` para `LoginBody`, `RegisterBody`, `RequestResetBody`, `ResetPasswordBody`, `RequestAccessBody` y aplicar el pipe. Limitar longitud de contraseña a 72 chars (bcrypt trunca silenciosamente después).

### ~~1.7 HTML escaping en emails · Esfuerzo S~~ ✅

`email.service.ts:41-94` interpola `name`, `email`, `reason` directamente en HTML sin escapar. Un atacante inyecta HTML/links en el email del admin. Agregar función `esc(s: string)` que reemplace `<>&"'` con entidades HTML y aplicarla a todos los interpolados.

---

## Fase 2 — Arquitectura: desacoplar el God Service

Estas tareas habilitan que las fases 3 y 4 sean tractables. Sin esto, cada feature nueva aumenta la deuda exponencialmente.

### ~~2.1 GameStateRepository · Esfuerzo M~~ ✅

Extraer de `game.service.ts` en `apps/backend/src/game/game-state.repository.ts`:

```ts
export class GameStateRepository {
  loadState(gameId: number, tx, userId?: number): Promise<GameState>
  saveState(gameId: number, state: GameState, tx): Promise<void>
  
  // Mapas con memoización por request (via WeakMap<tx, Map>)
  engineToDbTeam(gameId: number, tx): Promise<Map<string, number>>
  engineToDbFederation(gameId: number, tx): Promise<Map<string, number>>
  engineToDbCup(gameId: number, tx): Promise<Map<string, number>>
  engineToDbPlayer(gameId: number, tx): Promise<Map<string, number>>
}
```

Beneficios:
- Elimina el triple rebuild de `engineToDbTeam` por request (actualmente game.service.ts:1254, 1295, y dentro de detectRivalries).
- Centraliza el `assertGameOwner` (Fase 1.1).
- Centraliza las migraciones de forward-compat (ver 2.3).
- Cada servicio hijo lo inyecta; no duplican lógica de persistencia.

### ~~2.2 Split del GameController · Esfuerzo S~~ ✅

55 endpoints en un solo controller. Separar por dominio dentro del mismo `GameModule`:

```
game/
  controllers/
    season.controller.ts      # startSeason, advanceMatchday, closeSeason
    economy.controller.ts     # getEconomy, processContracts
    competition.controller.ts # cups, standings, structure, teams
    governance.controller.ts  # norms, events, impulses, sanctions
    negotiation.controller.ts # negotiations, market
    history.controller.ts     # history, world ranking, palmares
    io.controller.ts          # export, import
  services/
    game.service.ts           # temporalmente sigue aquí; refactor incremental
```

El split de controllers es mecánico (mover métodos + rutas) y de bajo riesgo. No requiere cambiar la lógica.

### ~~2.3 Versionar las migraciones de estado · Esfuerzo M~~ ✅

**Problema:** `game.service.ts:99-189` ejecuta ~50 líneas de defaults + reconstrucción de rival-divisions en CADA carga de estado, incluyendo reads puros. Crece con cada "Fase".

**Solución:**
1. Agregar `schemaVersion: number` a `GameState` (default 0).
2. Crear `packages/engine/src/migrations.ts` con `migrateState(state: GameState): GameState` que aplica patches por versión keyed y bumps `schemaVersion`.
3. En `loadState`: `if (state.schemaVersion < CURRENT_SCHEMA_VERSION) { state = migrateState(state); await saveState(state); }` — solo en el primer load post-deploy, nunca otra vez.

Resultado: los reads subsecuentes no pagan el costo de migración.

### ~~2.4 Curar el barrel del engine · Esfuerzo S~~ ✅

`packages/engine/src/index.ts` hace `export *` de 20 módulos. Todo es público; el backend puede usar helpers internos accidentalmente.

Reemplazar con exports explícitos: solo las funciones del ciclo principal (`createGame`, `startSeason`, `advanceMatchday`, `closeSeason`), los helpers de lectura (`standings`, `generateHeadlines`, etc.), y los tipos de `types.ts`. Los helpers internos de cada módulo dejan de ser accesibles.

### ~~2.5 Eliminar duplicación de enums engine ↔ contracts · Esfuerzo S~~ ✅

`contracts/src/index.ts` re-declara `NormType`, `NegotiationState`, `SeasonPhase`, `MandateType` como strings literales sincronizadas a mano con las unions del engine.

**Opción A (recomendada):** En `contracts`, importar las unions de `engine` y derivar los schemas Zod:
```ts
import type { NormType } from '@football-gm/engine';
export const NormTypeSchema = z.enum(['tope_plantilla', ...] as const satisfies [NormType, ...NormType[]]);
```

**Opción B:** Mover las unions a `contracts` y hacer que el engine las importe. Más disruptivo; no recomendado.

---

## Fase 3 — Base de datos: concurrencia y performance

### ~~3.1 SELECT FOR UPDATE en loadState · Esfuerzo S~~ ✅

**Problema:** Lost-update bajo tabs múltiples o doble-click. Dos requests leen estado N y ambos escriben N+1 — uno se pierde silenciosamente.

```ts
// En loadState, dentro de la transaction:
const rows = await tx
  .select()
  .from(gameEngineStates)
  .where(eq(gameEngineStates.gameId, gameId))
  .for('update');  // ← bloquea la fila hasta commit
```

Drizzle soporta `.for('update')`. Es la solución más simple y directa.

### ~~3.2 Pool config explícito · Esfuerzo S~~ ✅

`drizzle.ts:11` es `new Pool({ connectionString })` — defaults a max=10, sin timeouts.

```ts
new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  application_name: 'football-gm-backend',
})
```

### 3.3 Batch inserts en createGame · Esfuerzo M

`game.service.ts:462-517` inserta 132 equipos + sus jugadores uno por uno en un loop — ~150+ round-trips en una sola transacción. Usa `insert().values([...array])` para federaciones, equipos y jugadores en 3 queries totales.

Mismo problema en `closeSeason` con los `UPDATE` por equipo y por federación — usar `UPDATE ... SET x = CASE id WHEN ... END WHERE id IN (...)`.

### 3.4 Indexes faltantes · Esfuerzo S

Agregar en schema.ts + generar migración:
```ts
// matches, matchdays — solo tienen index en season_id/matchday_id, no en game_id
index('matches_game_id_idx').on(matches.gameId),
index('matchdays_game_id_idx').on(matchdays.gameId),

// sin índice alguno:
index('sanctions_game_id_idx').on(sanctions.gameId),
index('impulses_game_id_idx').on(impulses.gameId),
index('negotiation_requirements_game_id_idx').on(negotiationRequirements.gameId),
```

### 3.5 UNIQUE en columnas de link engine→DB · Esfuerzo S

`teams(game_id, engine_team_id)`, `federations(game_id, engine_federation_id)`, etc. son `index` simple. Deben ser `uniqueIndex` para que un doble-insert no corrompa silenciosamente los mapas (`.get(id)!` asume unicidad).

### 3.6 CHECK constraint en matchdays/matches · Esfuerzo S

`matchdays` y `matches` tienen FKs nullable a `division_id` y `cup_id`. Exactamente uno debe estar presente:
```sql
CONSTRAINT one_container CHECK (
  (division_id IS NULL) <> (cup_id IS NULL)
)
```

### 3.7 Enums PG para campos de texto cerrado · Esfuerzo M

`norms.tipo`, `negotiation_requirements.tipo`, `leagues.format`, `cups.formato` son `text` aunque tienen conjuntos cerrados. Promover a `pgEnum` (coordinado con 2.5 para no duplicar la fuente de verdad).

### 3.8 Paginación en listTeams / getHistory · Esfuerzo S

Ambos retornan conjuntos sin límite. Agregar `limit`/`offset` o cursor en la query y en el contrato.

---

## Fase 4 — Frontend: modularidad y performance

### 4.1 Lazy loading de rutas · Esfuerzo S

`router.tsx:5-25` importa estáticamente ~20 componentes de página. Solo `EconomyPage` y `HistoryPage` son lazy. Convertir todos los hijos de `gameRoute` a `lazy()`:

```ts
const DashboardPage = lazy(() => import('./routes/DashboardPage'));
// etc.
```

Mantine + recharts + tabler en el bundle inicial es el principal riesgo de TTI. Agregar en `vite.config.ts`:
```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-mantine': ['@mantine/core', '@mantine/hooks'],
        'vendor-charts': ['recharts'],
        'vendor-icons': ['@tabler/icons-react'],
      }
    }
  }
}
```

### 4.2 Constantes compartidas + ApiError class · Esfuerzo S

`TOKEN_KEY` y `API` (URL base) están definidos en 3 archivos distintos (`api.ts:32-33`, `AuthContext.tsx:4`, `router.tsx:27`). Extraer a `src/constants.ts`.

Crear `ApiError`:
```ts
export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}
```
El `req()` de `api.ts` lanza `ApiError` en lugar de `new Error(string)`. Las páginas pueden hacer `err instanceof ApiError && err.status === 409` en lugar de `error.message.includes(...)`.

### 4.3 Adoptar useMutationWithFeedback · Esfuerzo M

`src/useMutationWithFeedback.tsx` existe pero no está importado en ninguna página. `DashboardPage.tsx` reimplementa `handleSuccess`/`handleError` 8 veces inline. Adoptar el helper existente en todas las páginas — mecánico pero elimina ~200 líneas duplicadas y centraliza la invalidación de queries.

Centralizar las keys de invalidación en `src/queryKeys.ts`:
```ts
export const QK = {
  summary: (id: number) => ['summary', id],
  standings: (id: number, div: string) => ['standings', id, div],
  // ...
} as const;
```

### 4.4 matchReports en el contrato · Esfuerzo S

`DashboardPage.tsx:751,772,838` castea `summary.data as unknown as ExtendedSummary` para leer `matchReports` que no están en el schema. Agregar `matchReports` a `GameSummary` en `packages/contracts`. Eliminar los casts.

### 4.5 Route map en GameLayout · Esfuerzo S

El ternario de 14 niveles (GameLayout.tsx:117-144) y el if/else de 14 ramas de `go()` (146-174) reemplazados por:

```ts
const ROUTES = {
  negotiations: '/games/$gameId/negotiations',
  federations: '/games/$gameId/federations',
  // ...
} as const;

const active = Object.keys(ROUTES).find(k => p.includes(`/${k}`)) ?? 'dashboard';
const go = (value: string) => navigate({ to: ROUTES[value] ?? '/games/$gameId', params: { gameId } });
```

### 4.6 Extraer primitivas de UI compartidas · Esfuerzo M

Múltiples páginas repiten los mismos patrones visuales con HTML inline:
- Header gradient + ícono + título → `<PageHero icon={Icon} title="..." subtitle="..." />`
- Píldora de estado coloreada → `<StatusPill color="..." label="..." />`
- Sección con título y borde → `<SectionCard title="..." />`

Reemplazar los >174 `fontFamily: '"Geist Mono", monospace'` hardcoded por `fontFamily: theme.fontFamilyMonospace` (ya definido en `theme.ts:45`). Mismo para los hex `#10B981`, `#F59E0B`, `#EF4444` — mapear a colores del theme.

### 4.7 Descomponer DashboardPage · Esfuerzo M-L

`DashboardPage.tsx` (959 LOC) tiene 8+ secciones como IIFEs `(() => {...})()` inline. Extraer cada una como componente:
- `<StandingsTable gameId division standings />`
- `<MandateCard mandate impulsesRemaining />`
- `<HeadlinesFeed headlines />`
- `<MatchReports reports />`
- `<RivalResults rivalResults />`

No hace falta hacerlo todo de una; cada extracción es un PR independiente.

### 4.8 Testing frontend · Esfuerzo M

Instalar:
```bash
pnpm --filter @football-gm/frontend add -D vitest @testing-library/react @testing-library/user-event jsdom @vitejs/plugin-react
```

Primeras 5 pruebas de alto valor:
1. `api.ts` — `req()` maneja 401 (redirect) y errores 4xx/5xx
2. `GameLayout` — `active` tab detection dado un pathname
3. `BracketView` — render puro desde props
4. `mandate progress` calc (extraído de DashboardPage)
5. `useMutationWithFeedback` — hook con mocks de Query

---

## Fase 5 — DevOps y operaciones

### 5.1 Dockerfiles · Esfuerzo M

`Dockerfile.backend`:
```dockerfile
FROM node:22-alpine AS builder
# build monorepo con pnpm, output en /app
FROM node:22-alpine AS runtime
# copy apps/backend/dist + node_modules producción
EXPOSE 3000
```

`Dockerfile.frontend`:
```dockerfile
FROM node:22-alpine AS builder
# vite build → dist/
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### 5.2 CI/CD (GitHub Actions) · Esfuerzo M

`.github/workflows/ci.yml`:
```yaml
on: [push, pull_request]
jobs:
  quality:
    steps:
      - pnpm install
      - pnpm build          # turbo: engine+contracts primero
      - pnpm typecheck
      - pnpm lint
      - pnpm test
      - pnpm audit --audit-level=high
```

`.github/workflows/deploy.yml` (placeholder):
```yaml
on:
  push:
    branches: [main]
# build Docker images → push a registry → deploy
```

Secrets en CI: `JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY` — nunca en el código ni en `.env` trackeado.

### 5.3 Health endpoint · Esfuerzo S

```ts
// En app.module.ts o un HealthModule
@Get('/health')
health() { return { status: 'ok', ts: new Date().toISOString() }; }
```

Los load balancers y Render/Fly necesitan esto.

### 5.4 .env.example completo · Esfuerzo S

`apps/backend/.env.example` actualmente solo tiene `DATABASE_URL` y `PORT`. Agregar:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5544/football_gm
PORT=3000
JWT_SECRET=                   # REQUERIDO: string aleatoria >= 32 chars
ADMIN_EMAIL=                  # email del administrador
ADMIN_PASSWORD=               # contraseña inicial del admin (cambiar en primer login)
RESEND_API_KEY=               # dejar vacío para modo dry-run en local
APP_URL=http://localhost:5290  # URL del frontend (para links en emails)
FRONTEND_ORIGIN=http://localhost:5290  # para CORS
NODE_ENV=development
```

### 5.5 Logging y observabilidad · Esfuerzo M

- Reemplazar `console.log` por el `Logger` de NestJS en todos los servicios.
- En prod: JSON structured logging (Pino o el logger de NestJS configurado).
- Integrar Sentry (o similar) para error tracking — `app.use(Sentry.Handlers.errorHandler())`.
- Quitar el `console.log` del email del admin en boot (`auth.service.ts:207`).
- Global exception filter que no exponga stack traces en prod.

### 5.6 Estrategia de migración en prod · Esfuerzo S

Agregar a `apps/backend/package.json`:
```json
"db:migrate:prod": "drizzle-kit migrate --config=drizzle.prod.config.ts"
```
Documentar runbook: backup → migrate → verify → rollback manual si falla. Evaluar `CREATE INDEX CONCURRENTLY` para migraciones de índices en tablas con datos.

### 5.7 GDPR: retención y eliminación de PII · Esfuerzo M

La tabla `access_requests` nunca se purga y contiene nombres, emails y razones. Implementar:
- `DELETE /admin/users/:id` ya existe — extenderlo para eliminar también `access_requests`, `password_reset_tokens` y `games` del usuario.
- Política de retención: `access_requests` rechazadas → eliminar después de 90 días (cron job o trigger).
- Documentar qué PII se almacena en un `PRIVACY.md` simple.

---

## Backlog post-lanzamiento

Estas están en el diseño original pero no son urgentes para la producción inicial:

- **Batch 12.2** — Copa Inter-Ligas (inter-federation cup, `playerPrestige >= 50`)
- **Batch 12.3** — Informes del Comisionado (world reports page)
- **PgBouncer** en modo transaction pooling — solo si se supera una instancia de backend
- **Particionamiento** de `matches`/`trajectories` por `game_id` — solo a partir de cientos de juegos
- **Refresh tokens** — después de resolver H3 con token corto primero
- **Contrats versioning** — si en algún momento se rompe retrocompatibilidad de API

---

## Orden de ejecución sugerido

| Sprint | Tareas | Duración estimada | Estado |
|--------|--------|-------------------|--------|
| S1 | 1.1 IDOR, 1.2 JWT secret, 1.3 Rate limiting, 1.4 CORS+Helmet | 2-3 días | ✅ HECHO |
| S2 | 1.5 importGame validation, 1.6 Zod auth, 1.7 email escaping, 3.1 FOR UPDATE, 3.2 pool config | 2 días | ✅ HECHO |
| S3 | 2.1 GameStateRepository, 2.3 migraciones versionadas | 2-3 días | ✅ HECHO |
| S4 | 2.2 Split controllers, 2.4 engine barrel, 2.5 enum dedup | 1-2 días | ✅ HECHO |
| S5 | 3.3 Batch inserts, 3.4-3.7 indexes + constraints | 1-2 días | ✅ HECHO |
| S6 | 4.1 Lazy routes, 4.2 constants+ApiError, 4.3 useMutationWithFeedback | 1-2 días | ✅ HECHO |
| S7 | 5.1 Dockerfiles, 5.2 CI, 5.3 health, 5.4 .env.example | 2-3 días | — |
| S8 | 4.4-4.6 Frontend quality (matchReports, route map, primitivas) | 2 días | — |
| S9 | 4.7 Descomponer DashboardPage, 4.8 Testing setup | 2-3 días | — |
| S10 | 5.5-5.7 Observabilidad, PII/GDPR | 1-2 días | — |

**Total estimado:** 4-5 semanas a ritmo sostenible. **S1-S6 completados — frontend listo para escalar.**
