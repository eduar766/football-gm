# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Football league management simulator inspired by *Total Extreme Wrestling*. The player acts as a **commissioner** — not a coach or player — running a competition and growing it into a world-class league. Full design is in `diseno-simulador-liga.md` (Spanish).

## Monorepo layout

pnpm + Turborepo workspace (package manager: `pnpm`, Node >= 22):

```
apps/backend       @football-gm/backend     NestJS API (imperative shell: persistence + HTTP)
apps/frontend      @football-gm/frontend    React + Vite (data-only UI; Mantine + TanStack Router/Query)
packages/engine    @football-gm/engine      pure, seeded simulation core (no I/O)
packages/contracts @football-gm/contracts   shared Zod schemas + inferred DTOs (back/front contract)
packages/config    @football-gm/config      shared tsconfig / eslint / prettier
```

`engine` and `contracts` are built with **tsup** (emits `dist/` with `.d.ts`). The backend and frontend consume them as workspace packages.

## Commands

```bash
# First-time / each session: start the DB, then apply migrations
docker compose up -d                                      # Postgres 16 on :5544
pnpm --filter @football-gm/backend db:migrate             # apply drizzle migrations

# Run everything (turbo): builds engine+contracts first, then watches all apps
pnpm dev                        # backend :3000, frontend :5290, engine/contracts watchers

# Repo-wide
pnpm build                      # turbo run build
pnpm typecheck                  # turbo run typecheck (all 6 packages)
pnpm test                       # engine vitest + fast-check
pnpm lint

# Run a single test file
pnpm --filter @football-gm/engine test -- test/cups.test.ts
pnpm --filter @football-gm/engine test -- test/golden.test.ts --update   # update golden snapshot

# Database (drizzle-kit, from apps/backend or via --filter)
pnpm --filter @football-gm/backend db:generate            # generate migration from schema changes
pnpm --filter @football-gm/backend db:migrate             # apply migrations
```

## Ports

| Service  | URL                     | Notes                                   |
|----------|-------------------------|-----------------------------------------|
| Frontend | http://localhost:5290   | **Open this in the browser**            |
| Backend  | http://localhost:3000   | Routes under `/games/...`. `GET /` 404s by design |
| Postgres | localhost:**5544**      | Docker (`5544:5432` to avoid clashing with a local Postgres on 5432) |

The frontend reads `VITE_API_URL` (default `http://localhost:3000`) from `apps/frontend/.env.local`.
The backend reads `DATABASE_URL` (port 5544) from `apps/backend/.env`.

## Architecture

### Functional core / imperative shell

The engine (`packages/engine`) is **pure TypeScript with no I/O**. Every exported function takes a `GameState` and returns a new one (via `structuredClone` at the boundary). The backend is the imperative shell that owns persistence, HTTP, and side effects.

`GameState` is serialized as JSONB in `game_engine_states` and is the authoritative write-model. The relational tables (`teams`, `federations`, `season_records`, etc.) are the **read/history projections** — written at season close and used for SQL queries. They are never the source of truth for simulation state.

Every mutating backend operation follows this pattern:

```ts
return this.db.transaction(async (tx) => {
  const state = await this.loadState(gameId, tx);
  const next = engineDoSomething(state, args);
  await this.saveState(tx, gameId, next);
  return this.buildResponse(next, ...);
});
```

### Forward-compatibility pattern

When you add a new field to `GameState`, always add a default in `loadState()` so old saves don't break:

```ts
if (!state.newField) state.newField = defaultValue;
```

### RNG determinism — never mix the two RNGs

`GameState` has **two independent RNG streams**:
- `state.rng` — drives the match engine, norms, events, cups, negotiations, etc.
- `state.rivalRng` — drives rival league simulation only.

These must never cross. Any new simulation code that touches player leagues uses `state.rng`; anything in `rival-sim.ts` uses `state.rivalRng`. This keeps the golden snapshot deterministic regardless of whether rival sim runs.

### Core entity model

```
Federation  →  Division  →  Team  →  Player
Federation  →  Cup/Tournament
Season      →  Matchday  →  Match (2 teams)
Confederation  →  Federation (grouping for display)
```

Key modeling invariants:
- **Federation is one entity type** — player's and rivals' share the same model; distinguished by `isPlayer`. Rivals use the same tier/prestige rules.
- **Nothing is hard-deleted** — a team leaving a league re-associates to a new `federationId`, never deleted.
- **History is append-only** — `seasonRecords`, `trajectories`, and `awards` are written once at season close; palmarés and rankings are derived from them, never stored separately.
- **Tier is derived** — never stored; always computed from prestige via `tierOf()` in the engine.
- **Divisions carry `federationId`** — player's divisions have `federationId = playerFederationId`; rival federations have their own divisions with their own `federationId`.

### Key types (packages/engine/src/types.ts)

- `GameState` — the full serializable simulation state.
- `SeasonPhase` — `'pretemporada'` (setup window) | `'temporada'` (playable).
- `CupFormat` — `'eliminatoria'` | `'eliminatoria_ida_vuelta'` | `'liga'`.
- `NormType` — `'tope_plantilla' | 'minimo_competitivo' | 'tope_salarial' | 'tope_extrangeros' | 'minimo_cantera' | 'tope_edad_media'`.
- `NegotiationState` — `'gathering_requirements' | 'offer' | 'accepted' | 'effective' | 'rejected'`.
- `Player` — has `nationality: string` (`'local'`/`'extranjero'`) and `cantera: boolean` used by norm breach checks.
- `CupTemplate` — blueprint for recurring cups; saved at `closeSeason`, recreated in `pretemporada`.

### Contracts (packages/contracts/src/index.ts)

Single source of truth for the back/front contract. Backend validates incoming requests with Zod via `ZodValidationPipe`; frontend infers its types from the same schemas. No separate type definitions.

### Frontend routing

Uses TanStack Router with file-based-style routes in `apps/frontend/src/routes/`. `GameLayout.tsx` is the shell for all in-game pages; it wraps all game routes. `GamesPage.tsx` is the lobby (list/create games).

All API calls go through `apps/frontend/src/api.ts` — a typed fetch wrapper with no extra abstractions.

### Engine module responsibilities

| Module | Responsibility |
|--------|---------------|
| `engine.ts` | `createGame`, `startSeason`, `advanceMatchday`, `closeSeason` — the main season loop |
| `match.ts` | `simulateMatch` — Poisson-distributed goals, cards, goalscorers |
| `economy.ts` | Commercial contracts, revenue, costs, `processEconomy` at season close |
| `negotiation.ts` | Negotiation lifecycle, rival poach attempts |
| `norms.ts` | Norm creation, breach detection, `valorActual()` for count-based norms |
| `events.ts` | Event spawning, resolution, type-specific consequences |
| `cups.ts` | Cup creation, scheduling, `playCupRound`, two-leg aggregate logic |
| `rival-sim.ts` | `simulateRivalLeagues`, `driftRivalStrengths`, `updateRivalPrestige` |
| `seed-data.ts` | UEFA seed data: 7 federations, 132 real teams |
| `rng.ts` | Mulberry32 PRNG — deterministic, serializable as a single `u32` |

### Dev build-order gotcha

`engine`/`contracts` must have their `dist/` built before the backend typechecks. `turbo.json` handles this via `dependsOn: ["^build"]` in the `dev` task. The tsup watcher uses `clean: !options.watch` so it does **not** wipe `dist/` on start.

If you see `TS7016: Could not find a declaration file`, run `pnpm build` once, then `pnpm dev`.

## Key game mechanics

- **Prestige & tiers (1–5):** prestige is the main score; tier gates which teams you can negotiate with.
- **Snowball brakes:** two-year adhesion delay, tier gate, team `arraigo` (loyalty, 0–100), financial tension (commercial income must scale with league size), reactive rival federations.
- **Negotiation lifecycle:** tier check → requirements gathering (1–3 seasons, longer with high arraigo) → offer → accepted → effective two years after acceptance. Up to 5 years total.
- **Impulses:** limited per-season "thumb on the scale" actions that favor one team in a specific match.
- **Team autonomy:** teams manage their own squads. The player never signs players for a club — that would break the commissioner identity.
- **Recurring cups:** `Cup.recurring: boolean`; templates saved in `closeSeason()`, recreated in `pretemporada`.
- **Two-leg cups:** `'eliminatoria_ida_vuelta'` format; `computeTwoLegWinner()` resolves via aggregate → away goals → penalties.

## Adding a new game action (checklist)

1. Add pure function to the relevant engine module (takes + returns `GameState`).
2. Export it from `packages/engine/src/index.ts`.
3. Add request/response Zod schemas to `packages/contracts/src/index.ts`.
4. Add the endpoint to `apps/backend/src/game/game.controller.ts`.
5. Implement the `db.transaction(loadState → engine fn → saveState)` flow in `game.service.ts`.
6. Add the API call to `apps/frontend/src/api.ts`.
7. Wire up `useMutation` in the relevant frontend page.
8. Add engine tests in `packages/engine/test/`.
