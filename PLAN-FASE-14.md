# Plan Fase 14 — El Comisionado bajo presión

> Julio 2026. Dos beta-testers coinciden: **el juego se pasa dándole a "Siguiente"**.
> No hay fricción, no hay decisiones obligatorias, no hay consecuencias por no
> actuar, y todas las partidas empiezan igual ("Federación del Comisionado", 10
> equipos genéricos). Esta fase convierte el bucle pasivo en uno **de gestión con
> presión**: acciones obligatorias en pretemporada, un buzón que exige respuestas,
> peticiones de los clubes que erosionan el arraigo si se ignoran, un historial
> narrado de la federación, un creador de mundo con identidad propia, estructura
> de divisiones configurable, y **condiciones reales de derrota** (destitución).

---

## Diagnóstico — por qué "se pasa solo"

| Síntoma (feedback) | Causa raíz en el código | Archivo |
|--------------------|-------------------------|---------|
| "Es solo Siguiente y Siguiente" | `startSeason` no exige nada; se puede jugar sin premios, sin reparto, sin estructura | `engine.ts:459` `startSeason` |
| "No hay consecuencias" | No existe game-over / destitución. Fallar mandatos solo baja impulsos | `engine.ts:1006` `checkMandate` |
| "El rescate no lo piden los equipos" | `rescueTeam` es una acción libre del comisionado, sin gatillo | `game.service.ts:2185` |
| "No veo qué pasó con mi federación" | No hay log federación-nivel; solo `history[]` (campeones) y `rescueLog[]` | `types.ts:532` `SeasonRecord` |
| "Todas las partidas son iguales" | `generateWorld` hardcodea nombre + 10 equipos; `CreateGameRequest` solo tiene `name`+`seed` | `world-generator.ts:135,196`, `contracts:68` |
| "No puedo diseñar mis divisiones" | `runLevelingLeague` reparte con `ceil(n/12)` fijo, sin control de nº/tamaño/formato | `structure.ts:61` |
| "Poco arraigo → nada pasa" | Decay plano `-2/season`; los equipos nunca se van | `engine.ts:996` |

### Lo que ya existe y hay que reutilizar (no reinventar)

- **Eventos** (`events.ts`) — ya son "notificaciones con decisión" (actuar/ignorar) con
  coste de prestigio. El **Buzón** debe ser la capa unificadora sobre ellos, no un sistema paralelo.
- **`rescueLog[]`**, **`transfers[]`**, **`prizePayments[]`**, **`history[]`**, **`seasonChronicles[]`**
  ya son ledgers append-only: el **Historial de Federación** los agrega en una sola línea de tiempo.
- **`assertPretemporada` / `assertTemporada`** (`game.service.ts:531`) — patrón de guardas ya
  establecido; el gating de pretemporada es una guarda más.
- **`runLevelingLeague`** ya rankea por mini-liga y reparte: solo hay que parametrizar el reparto.
- **`buildSquad` / `makeUniqueNamer`** (`world-generator.ts`) ya generan nombres deterministas:
  reutilizar para el generador de nombres aleatorios de equipos.
- **`consecutiveMandateFails`** ya existe: es el primer insumo del medidor de confianza de la junta.

---

## Resumen de batches

| Batch | Título | Núcleo |
|-------|--------|--------|
| 14.1 | Identidad de partida (comisionado + federación + mundo) | contracts, world-generator, engine |
| 14.2 | Mundo con 15 equipos + generador de nombres aleatorios | world-generator, engine |
| 14.3 | Pretemporada obligatoria (checklist de arranque) | engine, backend, frontend |
| 14.4 | Buzón del Comisionado (inbox unificado) | engine (mailbox.ts), contracts, backend, frontend |
| 14.5 | Peticiones de los clubes + rescate solicitado + fuga por arraigo | engine, mailbox |
| 14.6 | Historial / Línea de tiempo de la federación | engine (federation-log.ts), backend, frontend |
| 14.7 | Estructura de divisiones configurable en la nivelación | engine (structure.ts), contracts, backend, frontend |
| 14.8 | Condiciones de derrota (confianza de la junta / destitución) | engine, contracts, frontend |

Cada batch es entregable de forma independiente. Orden recomendado: **14.1 → 14.2 → 14.6 → 14.4 → 14.5 → 14.3 → 14.8 → 14.7** (identidad y log primero porque los demás escriben en el log; el buzón antes que las peticiones que lo alimentan).

> **Migración única de la fase:** subir `CURRENT_SCHEMA_VERSION` de **5 → 6** en
> `migrations.ts`, con un solo bloque `if (state.schemaVersion < 6)` que inicializa
> TODOS los campos nuevos de esta fase a sus defaults (ver cada batch). No añadir
> defaults ad-hoc en `loadState()`.

---

## Batch 14.1 — Identidad de partida (comisionado + federación + mundo)

**Objetivo:** que el jugador nombre a su comisionado y su federación, y que el mundo
tenga variedad. Cada partida deja de empezar como "Federación del Comisionado".

### Contracts (`packages/contracts/src/index.ts:68`)

Extender `CreateGameRequest` (todo opcional → retrocompatibilidad con el lobby actual):

```ts
export const WorldSize = z.enum(['pequeno', 'estandar', 'grande']); // 10 / 15 / 20 equipos
export const CreateGameRequest = z.object({
  name: z.string().min(1).max(80),
  seed: z.number().int().nonnegative().optional(),
  commissionerName: z.string().min(1).max(60).optional(),
  federationName: z.string().min(1).max(60).optional(),
  worldSize: WorldSize.optional(),          // default 'estandar' (15) — ver 14.2
  startingDivisions: z.number().int().min(1).max(3).optional(), // reservado 14.7
});
```

### Engine (`types.ts` + `engine.ts`)

1. `GameState`: añadir `commissionerName: string` (default `'Comisionado/a'`).
2. `CreateGameOptions` (`types.ts:744`): añadir `commissionerName?`, `worldSize?`.
3. `createGame` (`engine.ts:95`): persistir `commissionerName`; ya acepta `playerFederationName`.

### World generator (`apps/backend/src/game/world-generator.ts`)

1. `generateWorld(seed, opts?)` — nueva firma con `{ size?: 'pequeno'|'estandar'|'grande' }`.
   El nombre de la federación deja de venir hardcodeado desde aquí: el backend usa
   `input.federationName ?? world.federationName`, y `world.federationName` pasa a ser
   un **nombre aleatorio determinista** (usar `makeUniqueNamer` con un pool de nombres
   de federación tipo `"Liga {Adjetivo} de {Región}"`).

### Backend (`game.service.ts:232` `createGame`)

```ts
const world = generateWorld(seed, { size: input.worldSize ?? 'estandar' });
const state = engineCreateGame(seed, {
  playerFederationName: input.federationName?.trim() || world.federationName,
  commissionerName: input.commissionerName?.trim() || 'Comisionado/a',
  worldSize: input.worldSize ?? 'estandar',
  // …resto igual
});
```

Recordar: la fila `s.federations` ya se inserta desde `state.federations`, así que el
nombre elegido se proyecta solo. Verificar que ninguna query use el literal
`'Federación del Comisionado'`.

### Frontend (`routes/GamesPage.tsx:54` formulario de creación)

Añadir al formulario de "Nueva partida": inputs `commissionerName`, `federationName`
(placeholders sugeridos), y un `SegmentedControl` de `worldSize` (Pequeño 10 / Estándar 15 /
Grande 20). Pasarlos en `api.createGame({...})`. Actualizar la firma en `api.ts`.

### Migración (v6)

```ts
if (state.schemaVersion < 6) {
  if (!state.commissionerName) state.commissionerName = 'Comisionado/a';
}
```

### Tests
- `engine`: `createGame` con `commissionerName`/`playerFederationName` los refleja en el estado.
- `world-generator` no está en el paquete `engine` (vive en backend); test unitario ligero
  en backend o, mejor, mover el pool de nombres a `seed-data.ts` para testearlo en engine.

---

## Batch 14.2 — Mundo con 15 equipos + nombres aleatorios de equipo

**Objetivo:** (a) 15 equipos por defecto al crear el mundo; (b) al **crear un equipo**
propio, poder pedir un nombre aleatorio además de escribirlo.

### 15 equipos (`world-generator.ts:135`)

`Array.from({ length: 10 }, …)` → tamaño según `worldSize`:
`{ pequeno: 10, estandar: 15, grande: 20 }`. **Cuidado con el golden master:** cambiar el
recuento por defecto altera el mundo generado. El golden test usa `createGame` del engine
directamente (no `generateWorld`), así que el snapshot del engine no depende de esto — pero
revisar que ningún test de backend asuma 10 equipos. Buscar `.length).toBe(10)` /
`teams.length` en `apps/backend`.

> **Nota de balance:** con 15 equipos en una sola división y `MAX_DIVISION_SIZE = 12`, la
> primera nivelación ya querrá 2 divisiones (`ceil(15/12)=2`). Esto conecta con 14.7 — dejar
> que el jugador decida el reparto en vez de imponer el `ceil`.

### Generador de nombres aleatorios de equipo

Reutilizar los pools `PREFIXES`/`PLACES` de `world-generator.ts` moviéndolos a un módulo
compartido del engine (p. ej. `packages/engine/src/names.ts`) para que **frontend y engine**
puedan usarlos. Exponer:

```ts
// names.ts (engine, sin I/O)
export function randomTeamName(rng: RngState, used?: Set<string>): string
```

**Endpoint** para nombre aleatorio (evita duplicar el pool en el front y respeta unicidad
contra los equipos existentes):

- Contract: `RandomTeamNameResponse = z.object({ name: z.string() })`.
- Ruta: `GET /games/:id/random-team-name` en `competition.controller.ts` (dominio estructura).
- Service: carga estado, usa `state.rng`… **NO** — no consumir el RNG de simulación por una
  acción de UI (rompería el golden). Usar un RNG efímero sembrado con `Date.now()` +
  `state.teams.length`, filtrando nombres ya usados por `state.teams`. Devolver solo el string.

### Frontend (`routes/StructurePage.tsx` o donde viva "Crear equipo")

Junto al input de nombre en el modal de crear equipo: botón **"🎲 Aleatorio"** que llama al
endpoint y rellena el input. Mantener el coste `CREATE_TEAM_COST` visible (5.000.000 €) y el
guard de tesorería ya existente (`engine.ts:543`).

### Tests
- `names.test.ts`: `randomTeamName` es determinista por seed y respeta `used`.
- Backend e2e opcional: el endpoint no muta el estado (mismo `schemaVersion`, mismo `rng`).

---

## Batch 14.3 — Pretemporada obligatoria (checklist de arranque)

**Objetivo:** no se puede `startSeason` hasta cumplir un **checklist de requisitos
estructurales**. El caso concreto del feedback: *"no debería poder iniciar la liga sin
premios y reparto asignados"*.

### Diseño

Función pura **`preseasonChecklist(state): ChecklistItem[]`** en un nuevo `engine/preseason.ts`.
Cada ítem: `{ id, label, done, blocking }`. `startSeason` (y la guarda del backend) rechazan si
algún ítem `blocking && !done`.

**Ítems bloqueantes (v1):**

| id | Condición `done` | Racional |
|----|------------------|----------|
| `premios_liga` | existe `competitionPrizes` con `kind:'liga'` y `pool > 0` | el jugador debe repartir premios |
| `reparto_valido` | ese premio de liga tiene `shares` que suman ~100 y cubren ≥ nº de plazas de podio | evita repartos vacíos |
| `estructura_definida` | toda división del jugador tiene ≥ 2 equipos y no hay equipos `divisionOrden===null` sin resolver | no arrancar con divisiones rotas / adhesiones sin ubicar |

**Ítems recomendados (no bloqueantes, informativos):** contratos comerciales activos,
al menos una norma definida, buzón sin peticiones urgentes pendientes (14.5).

> Regla de oro: **bloqueantes = "el juego no funciona sin esto"**; recomendados = "deberías
> hacerlo". No convertir todo en bloqueante o volvemos al muro de fricción.

### Engine

```ts
// preseason.ts
export interface ChecklistItem { id: string; label: string; done: boolean; blocking: boolean }
export function preseasonChecklist(s: GameState): ChecklistItem[]
export function preseasonBlockers(s: GameState): ChecklistItem[] // los blocking && !done
```

`startSeason` (`engine.ts:459`): al inicio, `if (preseasonBlockers(prev).length) return prev;`
(el engine ya devuelve `prev` sin mutar cuando una precondición no se cumple — mismo patrón que
`if (prev.phase !== 'pretemporada') return prev`).

### Backend

- `assertPreseasonReady(state)` nuevo en `game.service.ts`, llamado dentro de `startSeason`
  ANTES de `engineStartSeason`. Si hay bloqueantes, `throw new BadRequestException` con un
  payload estructurado `{ code: 'PRESEASON_INCOMPLETE', blockers: [...] }`.
- Endpoint de solo lectura `GET /games/:id/preseason-checklist` (season o competition controller)
  que devuelve `preseasonChecklist(state)` para pintar la UI.
- Contract: `ChecklistItemDto`, `PreseasonChecklistResponse`.

### Frontend

- En `DashboardPage` / `GameLayout`: cuando `phase === 'pretemporada'`, mostrar una **tarjeta
  "Antes de empezar la temporada"** con la lista (✓ verde / ✗ rojo, bloqueantes marcados).
- El botón **"Comenzar temporada"** queda `disabled` mientras haya bloqueantes, con tooltip que
  enumera lo que falta y enlaza a la página correspondiente (Premios, Estructura).
- Manejar el error `PRESEASON_INCOMPLETE` en `useMutationWithFeedback` mostrando los blockers.

### Migración
Ninguna (el checklist es derivado). Cuidado: **partidas guardadas a medio jugar en pretemporada**
podrían quedar bloqueadas si nunca asignaron premios → aceptable y deseado, pero documentarlo.

### Tests
- `preseason.test.ts`: estado recién creado tiene blockers (`premios_liga`); tras definir premios
  válidos y estructura, `preseasonBlockers` queda vacío y `startSeason` avanza a `temporada`.
- Regresión: `advanceSeason` en tests que ya definían premios sigue funcionando (revisar helpers de test).

---

## Batch 14.4 — Buzón del Comisionado (inbox unificado)

**Objetivo:** un buzón de entrada donde el comisionado recibe **información** (resultados
destacados, hitos, avisos) y **peticiones accionables** (rescates, demandas de clubes,
polémicas). Es la capa de UX que hace visible todo lo que hoy pasa silencioso.

### Modelo (`types.ts`)

```ts
export type MailboxCategory = 'peticion' | 'evento' | 'aviso' | 'hito' | 'financiero';
export type MailboxStatus = 'sin_leer' | 'leido' | 'resuelto' | 'caducado';

export interface MailboxMessage {
  id: number;
  year: number;
  matchday: number;          // 0 en pretemporada
  category: MailboxCategory;
  title: string;
  body: string;
  status: MailboxStatus;
  // Si es accionable, describe la acción y su gatillo:
  actionKind: 'rescue_request' | 'demand' | 'event' | null;
  refId: number | null;      // id del GameEvent / petición / equipo asociado
  teamId: number | null;
  deadlineMatchday: number | null; // si expira sin resolver → consecuencia (14.5)
  createdAtMatchday: number;
}
```

`GameState`: `mailbox: MailboxMessage[]`, `nextMailboxId: number`.

### Engine (`engine/mailbox.ts`)

Funciones puras:
- `pushMail(s, msg)` — helper central; **todos** los sistemas que hoy generan hechos relevantes
  llaman aquí (eventos al spawnearse, rescates solicitados, hitos de prestigio, contratos firmados).
- `markRead(s, id)`, `resolveMail(s, id)`.
- `expireMailbox(s)` — en `advanceMatchday`/`closeSeason`: mensajes con `deadlineMatchday`
  vencido y sin resolver pasan a `caducado` y disparan su consecuencia (14.5).

**Integración con eventos (clave para no duplicar):** en `events.ts:maybeSpawnEvent`, tras crear
el `GameEvent`, llamar `pushMail(s, { category:'evento', actionKind:'event', refId: event.id, … })`.
La página de Eventos actual puede quedar como vista filtrada del buzón, o mantenerse; el buzón es
el índice unificado. Resolver el evento (actuar/ignorar) marca su mail como `resuelto`.

### Contracts + Backend

- DTOs `MailboxMessageDto`, `MailboxListResponse`.
- `mailbox.controller.ts` (nuevo) o rutas en `game.controller.ts`:
  - `GET /games/:id/mailbox` (opcional `?status=sin_leer`)
  - `POST /games/:id/mailbox/:msgId/read`
  - `POST /games/:id/mailbox/:msgId/resolve` (delega a la acción concreta según `actionKind`)
- `game.service.ts`: métodos `getMailbox`, `markMailRead`, `resolveMail` con el patrón
  `transaction(load → engine fn → save)`.

### Frontend

- Nueva ruta `MailboxPage.tsx` + entrada en `GameLayout` sidebar con **badge de no-leídos**
  (reutilizar el patrón de "urgency badges" ya existente en `GameLayout`).
- Lista tipo bandeja: filtros por categoría, ítems accionables con botón directo (Rescatar,
  Ver evento, Responder). Ítems con `deadlineMatchday` muestran cuenta atrás.
- En Dashboard: widget "Buzón (N sin leer)" con los 3 más urgentes.

### Migración (v6)
```ts
if (!state.mailbox) state.mailbox = [];
if (state.nextMailboxId == null) state.nextMailboxId = 1;
```

### Tests
- `mailbox.test.ts`: `pushMail` incrementa id; `expireMailbox` caduca vencidos; spawnear un
  evento crea su mail asociado; resolver un evento marca el mail `resuelto`.

---

## Batch 14.5 — Peticiones de los clubes + rescate solicitado + fuga por arraigo

**Objetivo:** los clubes **piden cosas**. Si el comisionado no responde, su **arraigo baja** y,
si baja lo suficiente durante varias temporadas, **abandonan la federación**. Convierte el
arraigo (hoy decay plano) en un recurso que hay que defender activamente. El rescate deja de ser
una acción libre y pasa a ser **solicitado** por el club en crisis.

### Tipos de petición (`ClubDemand`)

```ts
export type ClubDemandType =
  | 'rescate'            // tesorería del club < umbral → pide inyección (reemplaza rescate libre)
  | 'mas_reparto'       // pide mayor % de premios / reparto
  | 'inversion_estadio' // pide apoyo a infraestructura
  | 'freno_sancion';    // pide clemencia ante sanciones repetidas

export interface ClubDemand {
  id: number;
  teamId: number;
  type: ClubDemandType;
  year: number;
  createdMatchday: number;
  deadlineMatchday: number;   // si no se atiende → penalización de arraigo
  amount: number | null;      // € pedidos (rescate/estadio)
  resolved: boolean;
  satisfied: boolean | null;  // true si se atendió a tiempo
}
```

`GameState`: `clubDemands: ClubDemand[]`, `nextDemandId: number`.

### Generación (engine, en `advanceMatchday` y/o `closeSeason`)

- **Rescate solicitado:** cuando `team.treasury < UMBRAL_CRISIS` (p. ej. < −2.000.000 €) y no
  hay ya una demanda de rescate abierta para ese club → crear `ClubDemand(type:'rescate')`,
  `pushMail(category:'peticion', actionKind:'rescue_request', teamId, deadlineMatchday=+3)`.
  Esto sustituye el gatillo manual: `rescueTeam` sigue existiendo pero ahora **cierra** una demanda.
- **Otras demandas:** con baja probabilidad por jornada (RNG de eventos), sesgada por arraigo bajo
  o mandato exigente. Máx. 1 demanda abierta por club.

### Consecuencia de ignorar (el "diente" que pedía el feedback)

En `expireMailbox` / al vencer `deadlineMatchday` sin resolver:
```
demand.resolved = true; demand.satisfied = false;
team.arraigo = clamp(team.arraigo - PENALIZACION_IGNORAR, 0, 100);  // p.ej. -12
pushMail(category:'aviso', title:`${team.name} se siente ignorado`, …)
```

### Fuga de equipos (nueva mecánica de pérdida)

En `closeSeason`, tras el decay: para cada equipo del jugador con `arraigo <= UMBRAL_FUGA`
(p. ej. ≤ 10) durante ≥ 2 cierres consecutivos → el equipo **se re-asocia a una federación rival**
(o a un "limbo" sin federación jugadora). **Nada se borra** (invariante del proyecto): solo cambia
`federationId` y `divisionOrden = null`. Registrar en el log de federación (14.6) y en el buzón.
Añadir contador `team.lowArraigoSeasons` (o `Record<teamId, number>` en el estado) para el "≥2
consecutivos".

> Esto alimenta directamente la condición de derrota "éxodo de clubes" del batch 14.8.

### Atender una demanda

- `rescate` → reutiliza `engineRescueTeam` (marca la demanda satisfecha).
- `mas_reparto` / `inversion_estadio` / `freno_sancion` → nuevas funciones pequeñas en el engine
  que aplican el efecto (subir shares, subir `stadiumCapacity`/`academia`, retirar una sanción) y
  marcan `satisfied=true`, subiendo un poco el arraigo (+6) como recompensa.

### Contracts + Backend + Frontend
- DTO `ClubDemandDto`; incluir demandas en la respuesta del buzón (son mails `peticion`).
- Rutas de resolución específicas o una genérica `POST /games/:id/demands/:demandId/resolve`
  con body `{ accept: boolean, amount?: number }`.
- Frontend: en `MailboxPage`, las peticiones muestran el impacto ("Si ignoras: −12 arraigo") y
  el arraigo actual del club.

### Migración (v6)
```ts
if (!state.clubDemands) state.clubDemands = [];
if (state.nextDemandId == null) state.nextDemandId = 1;
```

### Tests
- `demands.test.ts`: club bajo umbral genera demanda de rescate + mail; ignorarla hasta el
  deadline baja arraigo; atenderla lo sube y cierra el mail.
- `exodus.test.ts`: dos cierres con arraigo ≤ umbral → el equipo cambia de `federationId` y
  `divisionOrden = null`; sigue existiendo en `state.teams`.
- **Golden master:** estas mecánicas usan `eventsRng`/RNG dedicado, NO `state.rng`. Verificar que
  `golden.test.ts` no cambia (si cambia, revisar que ningún path toque el stream de simulación).

---

## Batch 14.6 — Historial / Línea de tiempo de la federación

**Objetivo:** una vista cronológica de **qué le ha pasado a mi federación**: patrocinios
firmados, negociaciones/adhesiones, equipos creados, rescates, prestigio al cierre de cada
temporada, hitos. Hoy esa información existe dispersa en ledgers separados y no se muestra junta.

### Modelo (`types.ts`)

```ts
export type FederationLogType =
  | 'prestige_snapshot'   // cierre de temporada: prestigio antes/después
  | 'sponsor_signed'      // contrato comercial firmado
  | 'negotiation_started' | 'negotiation_effective'  // adhesión de equipo
  | 'team_created' | 'team_left'
  | 'rescue' | 'norm_created' | 'sanction' | 'mandate_result'
  | 'promotion' | 'title'; // campeón de liga/copa de la federación

export interface FederationLogEntry {
  id: number;
  year: number;
  matchday: number;      // 0 = pretemporada / cierre
  type: FederationLogType;
  title: string;
  detail: string;
  value: number | null;  // € o prestigio según el tipo
  teamId: number | null;
}
```

`GameState`: `federationLog: FederationLogEntry[]`, `nextFederationLogId: number`.

### Estrategia de escritura — un helper, muchos call-sites

`engine/federation-log.ts`:
```ts
export function logFederation(s: GameState, entry: Omit<FederationLogEntry,'id'>): void
```

Insertar llamadas en los puntos donde ya ocurren los hechos (no crear nuevos):
- `economy.ts` al firmar contrato comercial → `sponsor_signed`.
- `negotiation.ts` al iniciar / hacer efectiva una adhesión → `negotiation_*`.
- `engine.ts createOwnTeam` → `team_created`; fuga (14.5) → `team_left`.
- `engine.ts rescueTeam` → `rescue` (ya hay `rescueLog`; añadir también al federationLog o hacer
  que el timeline agregue ambos — preferible **una sola fuente**: migrar a `federationLog`).
- `closeSeason` → `prestige_snapshot` (año, prestige antes/después; el delta ya se calcula para
  `SeasonRecord`), `mandate_result`, títulos.

> Decisión de diseño: **no duplicar**. `rescueLog`, `history`, `prizePayments`, `transfers`
> siguen siendo la verdad de sus dominios; `federationLog` es la **capa narrativa agregada**
> escrita en los mismos call-sites. Alternativa (más barata, menos flexible): NO añadir
> `federationLog` y construir el timeline **derivándolo** en el backend a partir de los ledgers
> existentes. **Recomendación: capa dedicada** — más simple de renderizar y de extender, y encaja
> con el estilo append-only del proyecto. Elegir una y ser consistente.

### Migración (v6)
```ts
if (!state.federationLog) state.federationLog = [];
if (state.nextFederationLogId == null) state.nextFederationLogId = 1;
// Backfill mínimo: sembrar prestige_snapshot desde state.history existente
for (const h of state.history ?? []) {
  state.federationLog.push({
    id: state.nextFederationLogId++, year: h.year, matchday: 0,
    type: 'prestige_snapshot',
    title: `Cierre ${h.year}`, detail: `Prestigio ${h.prestigeBefore}→${h.prestigeAfter}`,
    value: h.prestigeAfter, teamId: null,
  });
}
```

### Backend + Frontend
- `GET /games/:id/federation-log` (history.controller.ts). DTO `FederationLogEntryDto`.
- Nueva vista `FederationTimelinePage.tsx` (o pestaña "Historia" en `FederationPage.tsx`):
  timeline vertical agrupado por año, iconos por `type`, filtros. Gráfica de prestigio por
  temporada usando los `prestige_snapshot`.

### Tests
- `federation-log.test.ts`: firmar patrocinio, crear equipo y cerrar temporada añaden entradas
  con el `type` correcto y en orden cronológico.

---

## Batch 14.7 — Estructura de divisiones configurable en la nivelación

**Objetivo:** la liga principal (orden 1) no se toca, pero al **crear una liga de nivelación**
el jugador decide la **nueva estructura**: cuántas divisiones, tamaño de cada una, y formato
(ida / ida y vuelta) por división. Los peor clasificados de la nivelación caen a 2ª/3ª.

Ejemplo del feedback: *20 equipos → 1ª de 12 + 2ª de 8; los 8 últimos de la nivelación van a 2ª*.

### Modelo

Hoy `runLevelingLeague` impone `nDiv = ceil(n/12)` y `groupSizes` balanceado. Parametrizar:

```ts
// contracts + engine option
export interface LevelingPlan {
  divisions: Array<{
    orden: number;
    name?: string;               // default divisionName(orden)
    size: number;                // nº de equipos que caen aquí
    format: 'ida' | 'ida_vuelta';
  }>;
}
```

Reglas de validación (engine + Zod):
- `sum(size) === nº de equipos del jugador (competing + pending)`.
- `orden` consecutivos empezando en 1; cada `size >= 2`.
- Nº de divisiones ≤ 3 (límite razonable de la fase).

### `leagueFormat` por división

Hoy `leagueFormat` es **global** (`GameState.leagueFormat`, usado en `buildDivisionFixtures`,
`engine.ts:466`). El feedback pide formato por división ("que la próxima sea solo un juego"). Dos
opciones:

1. **Mínimo viable:** mantener `leagueFormat` global pero permitir cambiarlo en el plan de
   nivelación (afecta a todas las divisiones). Menos trabajo, cubre "la próxima temporada a una
   sola vuelta".
2. **Completo:** mover el formato a `Division` (`Division.format: 'ida'|'ida_vuelta'`) y que
   `buildDivisionFixtures` lo lea por división. Requiere migración de `divisions` y tocar
   `fixtures.ts` + `startSeason`. **Recomendado** porque es lo que pide literalmente el usuario,
   pero aislar el cambio de fixtures y cubrirlo con golden.

> Recomendación: implementar **opción 2** pero con migración que rellena `Division.format` desde
> el `leagueFormat` global actual, y deprecar `leagueFormat` global (mantenerlo leído como default).

### Engine (`structure.ts:61` `runLevelingLeague`)

Nueva firma `runLevelingLeague(prev, plan?: LevelingPlan)`:
- Si `plan` ausente → comportamiento actual (retrocompat).
- Si presente → rankear por mini-liga (ya existe `rankByMiniLeague`), luego repartir por `plan`:
  los primeros `size` de la 1ª división, siguientes `size` a la 2ª, etc. (los mejores arriba).
- Escribir `Division.format` desde el plan.
- **La 1ª división del jugador (orden 1) conserva su identidad/nombre**; solo cambian miembros y,
  si el plan lo indica, se añaden órdenes 2/3 nuevos.

### Contracts + Backend
- `RunLevelingLeagueRequest = z.object({ plan: LevelingPlan.optional() })`.
- `competition.controller.ts:43` `levelingLeague` → aceptar body con el plan; validar suma de
  tamaños contra el nº real de equipos (devolver 400 con mensaje claro si no cuadra).

### Frontend (`StructurePage.tsx`)
- UI de "Planificar nivelación": mostrar nº de equipos disponibles; el jugador añade divisiones,
  fija tamaños (con validación en vivo de la suma) y elige formato por división. Preview del
  reparto tras confirmar.

### Migración (v6)
```ts
// Si se adopta Division.format:
for (const d of state.divisions) if (!d.format) d.format = state.leagueFormat ?? 'ida_vuelta';
```

### Tests
- `leveling.test.ts`: 20 equipos + plan (12/8) → división 1 tiene los 12 mejores, división 2 los
  8 peores; formatos aplicados. Plan con suma incorrecta → rechazado (engine devuelve `prev` o
  el backend lanza 400).
- Golden: si se mueve el formato a `Division`, re-generar snapshot revisando el diff con cuidado.

---

## Batch 14.8 — Condiciones de derrota (confianza de la junta / destitución)

**Objetivo:** que se pueda **perder**. Hoy fallar mandatos solo baja impulsos. Introducir un
medidor de **confianza de la junta (0–100)** y una condición de **destitución** (game over) con
varias causas, atendiendo a *"más condiciones de derrota / más razones por las que se pueda perder"*.

### Modelo (`types.ts`)

```ts
export interface BoardConfidence {
  value: number;          // 0-100, empieza en ~60
  history: Array<{ year: number; value: number; reason: string }>;
}
export type GameOverReason =
  | 'destitucion_confianza'   // confianza llega a 0
  | 'quiebra'                 // tesorería federación muy negativa varias temporadas
  | 'exodo'                   // se fueron demasiados equipos (14.5)
  | 'mandatos'               // N mandatos fallados consecutivos
  | 'liga_vacia';            // menos de 2 equipos competitivos

export interface GameOver { reason: GameOverReason; year: number; message: string }
```

`GameState`: `boardConfidence: BoardConfidence`, `gameOver: GameOver | null`.

### Reglas de confianza (evaluadas en `closeSeason`)

Ajustar `value` con deltas acumulables:
| Causa | Δ confianza |
|-------|-------------|
| Mandato cumplido | +8 |
| Mandato fallado | −15 |
| Prestigio subió esta temporada | +5 |
| Prestigio cayó | −6 |
| Tesorería federación negativa al cierre | −10 |
| Equipo se fue (por arraigo, 14.5) | −12 por equipo |
| Petición de club caducada sin atender | −4 por petición |
| Ganar un título de la federación | +6 |

Clamp `[0,100]`. Registrar cada cambio en `history` y en el `federationLog` (14.6) + buzón.

### Condiciones de game over (cualquiera dispara `gameOver`)

- `boardConfidence.value <= 0`.
- `consecutiveMandateFails >= 3` (endurece la regla actual de 2→−impulso).
- Tesorería de la federación negativa **2 cierres consecutivos** (nuevo contador
  `negativeTreasurySeasons`).
- `< 2` equipos del jugador con `divisionOrden !== null` (liga inviable).
- Éxodo: `≥ 3` equipos se fueron en total (o en ventana de 2 temporadas).

Al dispararse: `s.gameOver = {…}`. `advanceMatchday`/`startSeason`/`closeSeason` devuelven `prev`
si `state.gameOver` ya está fijado (no se sigue jugando). El backend lo expone y el front bloquea.

### Contracts + Backend
- DTOs `BoardConfidenceDto`, `GameOverDto`; incluir en `GameSummary`/dashboard payload.
- No hace falta endpoint nuevo: viaja en el resumen del juego. Opcional
  `POST /games/:id/acknowledge-gameover` que archiva la partida.

### Frontend
- **Stat pill "Confianza de la junta"** en `GameLayout` (color según umbral) + mini-gráfica en
  Dashboard con el `history`.
- Cuando `gameOver !== null`: modal de **"Has sido destituido"** con el motivo y un resumen de la
  trayectoria (usar el `federationLog`), y CTA para volver al lobby / exportar la partida.
- Avisos tempranos vía buzón cuando la confianza baja de 30 ("La junta te observa").

### Migración (v6)
```ts
if (!state.boardConfidence) state.boardConfidence = { value: 60, history: [] };
if (state.gameOver === undefined) state.gameOver = null;
if (state.negativeTreasurySeasons == null) state.negativeTreasurySeasons = 0;
```

### Tests
- `board-confidence.test.ts`: fallar mandato baja confianza; encadenar fallos hasta `gameOver`.
- `game-over.test.ts`: tesorería negativa 2 cierres → `gameOver.reason === 'quiebra'`; con
  `gameOver` fijado, `advanceMatchday` es no-op.
- **Golden:** confianza y game-over se evalúan en `closeSeason` con datos ya existentes (no RNG de
  simulación). Confirmar que el snapshot no se altera salvo por campos nuevos (que el golden no
  serializa si solo compara `state.history`).

---

## Riesgos transversales y notas de implementación

1. **Golden master (`golden.test.ts`).** Regla inquebrantable del proyecto: mecánicas nuevas que
   necesiten azar usan `eventsRng` o un RNG dedicado, **nunca** `state.rng`. Batches 14.4/14.5/14.8
   están diseñados para no tocar el stream de simulación. Tras cada batch: `pnpm test` y, si el
   golden cambia, entender **por qué** antes de `--update`.

2. **Migración única v5→v6.** Todos los campos nuevos (`commissionerName`, `mailbox`,
   `nextMailboxId`, `clubDemands`, `nextDemandId`, `federationLog`, `nextFederationLogId`,
   `boardConfidence`, `gameOver`, `negativeTreasurySeasons`, `Division.format`) se inicializan en
   un solo bloque `if (state.schemaVersion < 6)` en `migrations.ts`, siguiendo la nota del CLAUDE.md
   ("no defaults ad-hoc en loadState"). Subir `CURRENT_SCHEMA_VERSION` a 6.

3. **Contaminación de división.** Toda query nueva (buzón, demandas, log, timeline) que liste datos
   del jugador debe filtrar por `federationId === playerFederationId` (invariante del proyecto).

4. **Checklist de "nueva acción" (CLAUDE.md).** Cada endpoint nuevo sigue los 9 pasos: engine puro →
   export en `index.ts` → Zod en contracts → controller correcto → `transaction(load→fn→save)` en
   `game.service.ts` → `api.ts` → `useMutation` → tests → migración si hay campo nuevo.

5. **Retrocompatibilidad del lobby.** `CreateGameRequest` mantiene todos los campos nuevos
   `optional()`; una partida creada con el formulario viejo (solo `name`+`seed`) sigue funcionando
   con defaults (federación aleatoria, 15 equipos, comisionado genérico).

6. **Balance / playtesting.** Todos los umbrales numéricos (UMBRAL_CRISIS, PENALIZACION_IGNORAR,
   UMBRAL_FUGA, deltas de confianza) van como **constantes con nombre** al principio de su módulo
   para tunearlos rápido tras probar con los dos beta-testers. Empezar conservador y endurecer.

---

## Orden de entrega sugerido y "definition of done" por batch

1. **14.1 + 14.2** (identidad + mundo) — desbloquea variedad, bajo riesgo. *DoD:* crear partida
   con nombres propios y 15 equipos; nombre aleatorio de equipo funciona.
2. **14.6** (federation log) — infraestructura que consumen 14.5/14.8. *DoD:* timeline muestra
   patrocinios, equipos creados y prestigio por temporada.
3. **14.4** (buzón) — capa de UX central. *DoD:* eventos aparecen en el buzón con badge de no-leídos.
4. **14.5** (peticiones + fuga) — el "diente". *DoD:* club en crisis pide rescate; ignorarlo baja
   arraigo; arraigo crónico bajo → el equipo se va.
5. **14.3** (pretemporada obligatoria) — fricción de arranque. *DoD:* no se puede iniciar sin
   premios+reparto+estructura; el front lo explica.
6. **14.8** (derrota) — cierra el bucle de presión. *DoD:* se puede ser destituido por ≥1 causa.
7. **14.7** (estructura configurable) — el más grande; dejar al final. *DoD:* nivelación con plan
   12/8 reparte correctamente y aplica formatos.

Al terminar la fase: `pnpm build && pnpm typecheck && pnpm lint && pnpm test` en verde, golden
revisado, y una pasada de playtesting con los dos beta-testers para calibrar umbrales.
