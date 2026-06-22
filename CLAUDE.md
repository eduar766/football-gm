# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Football league management simulator inspired by *Total Extreme Wrestling*. The player acts as a **commissioner** — not a coach or player — running a competition and growing it into a world-class league. Full design is in `diseno-simulador-liga.md` (Spanish).

## Planned stack

- **Backend:** NestJS + TypeScript
- **Database:** PostgreSQL — the entity model is fully relational; history tables are append-only
- **Frontend:** React (data-only UI: tables and lists, no 3D engine)
- **Phase 3 (future):** Python service for narrative pattern detection; LLM-generated season chronicles

## Build roadmap

The design document marks phases 1–2 as done (design). Remaining phases:

1. **Data schema** — translate entity model to DB tables
2. **Minimum loop** — simulate a season, produce a standings table (match engine = weighted random by squad quality)
3. **Commissioner systems** — prestige, tiers, negotiation, snowball brakes, reactive federations
4. **History layer** — append-only tables + derived views (standings, top scorers, awards)
5. **Polish** — match engine realism, events, controversies

**Prototype path:** single React artifact, in-memory, no backend. 10 teams, table, "advance season" button, prestige. Validates fun before multi-week investment.

## Core entity model

```
Federation  →  League  →  Division  →  Team  →  Player
Federation  →  Cup/Tournament
Season      →  Matchday  →  Match (2 teams)
```

Key modeling decisions (from the design doc):
- **Federation is one entity type** — the player's federation and rival federations share the same model; distinguished by an `is_player` flag.
- **Nothing is hard-deleted** — a team leaving a league changes federation association, never gets deleted (preserves history).
- **History is append-only** — season records, trajectories, and awards are written once at season close and never mutated. Derived views (palmarés, rankings) are computed from those records, not stored separately.
- **Impulses** — limited per-season "thumb on the scale" actions; they hang off `Season` (counter) and point to a specific `Match`.
- **Negotiation** has its own lifecycle: tier check → requirement gathering (1–2 years) → offer/acceptance → effective **two years after acceptance**. Total: up to 5 years.

## Key game mechanics to preserve

- **Prestige & tiers (1–5):** prestige is the main score; tier gates which teams you can negotiate with. A tier-4 federation cannot approach tier-1+ clubs.
- **Snowball brakes:** two-year adhesion delay, tier gate, team `arraigo` (loyalty to current federation), financial tension (commercial income must scale with league size), reactive rival federations.
- **Team autonomy:** teams manage their own squads, coaches, youth academies. The player never signs players for a club — doing so would break the commissioner identity.

## Monorepo layout

pnpm + Turborepo workspace (package manager: `pnpm`, Node >= 22):

```
apps/backend      @football-gm/backend    NestJS API (imperative shell: persistence + HTTP)
apps/frontend     @football-gm/frontend   React + Vite (data-only UI)
packages/engine   @football-gm/engine     pure, seeded simulation core (no I/O)
packages/contracts @football-gm/contracts shared zod schemas + inferred DTOs (back/front contract)
packages/config   @football-gm/config     shared tsconfig / eslint / prettier
```

`engine` and `contracts` are built with **tsup** (emits `dist/` with `.d.ts`). The backend
and frontend consume them as workspace packages, so those `dist/` types must exist before
the backend typechecks — see the dev note below.

## Ports

| Service  | URL                     | Notes                                   |
|----------|-------------------------|-----------------------------------------|
| Frontend | http://localhost:5290   | **Open this in the browser** — the app  |
| Backend  | http://localhost:3000   | API only; routes under `/games/...`. `GET /` 404s by design |
| Postgres | localhost:**5544**      | Docker (`5544:5432` to avoid clashing with a local Postgres on 5432) |

The frontend reads `VITE_API_URL` (default `http://localhost:3000`) from `apps/frontend/.env.local`.
The backend reads `DATABASE_URL` (port 5544) from `apps/backend/.env`.

## Commands

```bash
# First-time / each session: start the DB, then apply migrations
docker compose up -d            # starts football-gm-db (Postgres 16) on :5544
pnpm --filter @football-gm/backend db:migrate   # apply drizzle migrations

# Run everything (turbo): builds engine+contracts, then watches all apps
pnpm dev                        # backend :3000, frontend :5290, engine/contracts watchers

# Per-package / repo-wide
pnpm build                      # turbo run build
pnpm typecheck                  # turbo run typecheck
pnpm test                       # turbo run test (engine has vitest + fast-check)
pnpm lint

# Database (drizzle-kit, run from apps/backend or via --filter)
pnpm --filter @football-gm/backend db:generate  # generate migration from schema changes
pnpm --filter @football-gm/backend db:migrate   # apply migrations
```

### Dev build-order gotcha (important)

`engine`/`contracts` are built by `tsup --watch`. Two things keep the backend's
`nest --watch` from failing with `TS7016: Could not find a declaration file`:
- `turbo.json` → the `dev` task has `dependsOn: ["^build"]`, so deps are built before backend starts.
- `packages/{engine,contracts}/tsup.config.ts` → `clean: !options.watch`, so the watcher
  does **not** wipe `dist/` (and its `.d.ts`) on startup, which previously left a window where
  the backend resolved those imports as `any` and got stuck on stale errors.

If you ever see that error, the dist types are missing — run `pnpm build` once, then `pnpm dev`.

---

## Current Session State

> **Last updated:** Junio 2026 — After Fase 8 Batch 1 + #11 (tipos de sanciones) + UI improvements batch

### What was done

12 features implemented across 3 batches:

**Fase 6 — Batch de mejoras (Baja/Media/Alta):**

| # | Feature | Key files |
|---|---------|-----------|
| #13 | Revisión + Reunión de emergencia | `game.service.ts`, `game.controller.ts`, `DashboardPage.tsx` |
| #8 | Evento notificación tardía | `DashboardPage.tsx` (query invalidation) |
| #2 | Selección masiva equipos | `CupsPage.tsx` (select all/clear buttons) |
| #3 | BYE ocultos en brackets | `CupsPage.tsx`, `DashboardPage.tsx` |
| #7 | UI premios mejorada | `PrizesPage.tsx` (ShareEditor component) |
| #9 | Celebración de campeón | `DashboardPage.tsx` (golden alert) |
| #10 | Nombres de patrocinadores | `economy.ts`, `EconomyPage.tsx` |
| #5 | Bracket inline en dashboard | `DashboardPage.tsx` |
| #12 | Requisitos de equipos | `TeamDetailPage.tsx`, `game.service.ts` |
| #1 | Copa ida y vuelta | `cups.ts`, `types.ts`, `CupsPage.tsx` (full 2-leg implementation) |

**Fase 7 — Consecuencias reales en eventos:**

| Feature | Key files |
|---------|-----------|
| Type-specific event consequences | `events.ts` (switch-case por tipo) |
| 4 new GameState fields | `types.ts`, `engine.ts` (init + reset) |
| Capacity penalty in revenue | `economy.ts` |
| Effect descriptions | `contracts/index.ts`, `game.service.ts`, `EventsPage.tsx` |

**Fase 8 Batch 1 — Estrategia y dificultad:**

| Feature | Key files |
|---------|-----------|
| Fix crisis_economica_club exploit | `events.ts` (+3M€ but -5 strength) |
| Norm enforcement cost (500K€/norm) | `economy.ts`, `types.ts`, `contracts` |
| cultivateArraigo action (2M€, +5-10) | `engine.ts`, `game.service.ts`, `game.controller.ts`, `TeamDetailPage.tsx` |
| Arraigo decay (-2/season) | `engine.ts` closeSeason |
| Poach cooldown (2 seasons) | `negotiation.ts`, `types.ts` (poachCooldowns) |
| Base prestige decay -1 → -2 | `engine.ts` closeSeason |
| Cup creation cost (2M€) | `cups.ts` |
| Tipos de sanciones (#11) | `types.ts`, `norms.ts`, `contracts`, `NormsPage.tsx` |

**UI improvements batch:**

| Feature | Key files |
|---------|-----------|
| Negotiations: active/history tabs + retry | `NegotiationsPage.tsx` (Tabs, retry button for rejected) |
| Palmarés in team detail | `TeamDetailPage.tsx`, `game.service.ts` (palmares section) |
| Teams page: my league vs other federations tabs | `TeamsPage.tsx` (Tabs, group by federation) |
| Rival federation structures | `FederationPage.tsx`, `game.service.ts`, `game.controller.ts` |
| Recurring cups | `cups.ts`, `types.ts`, `CupDto`, `CupsPage.tsx` (checkbox, badge) |

### What's pending

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| Fase 8 Batch 2 | Narrativa (form streaks, event chains, title tension) | Alta | see PLAN-UNIFICADO.md |
| — | Tests for ida y vuelta | Alta | Add test cases for `eliminatoria_ida_vuelta` in `cups.test.ts` |
| — | Tests for new norm types | Alta | Add test cases for `tope_extrangeros`, `minimo_cantera`, `tope_edad_media` in `norms.test.ts` |

### Verification status

```bash
pnpm typecheck          # 6/6 packages pass
pnpm test               # engine 99/99 pass (14 files)
# golden snapshot may need: pnpm --filter @football-gm/engine test -- --update
```

### Key architecture notes for next session

- **Engine `CupFormat`** at `types.ts:144`: `'eliminatoria' | 'eliminatoria_ida_vuelta' | 'liga'`
- **Engine `CupMatch.leg`** and **`CupRound.leg`**: optional `'ida' | 'vuelta'` field
- **`playCupRound()`** in `cups.ts`: handles ida (play only) vs vuelta (play + aggregate + winner)
- **`computeTwoLegWinner()`**: aggregate → away goals → penalties
- **`scheduleCups()`**: ida/vuelta on consecutive matchdays
- **Contracts `CupMatchDto.leg`** and **`CupRoundDto.leg`**: optional, passed through backend `cupsResponse()`
- **`NormType`** in engine is `'tope_plantilla' | 'minimo_competitivo' | 'tope_salarial' | 'tope_extrangeros' | 'minimo_cantera' | 'tope_edad_media'` — all 6 values
- **Player model** now has `nationality: string` ('local'/'extranjero') and `cantera: boolean` — seeded in world-generator, stored in DB, passed through contracts
- **Norm breach logic** in `norms.ts`: `valorActual()` computes count-based values for new norm types (foreign count, cantera count, avg age)
- **Recurring cups**: `Cup.recurring: boolean` flag; `CupTemplate` type in engine; templates saved in `closeSeason()` and recreated in pretemporada
- **Federation detail**: `GET /games/:id/federations/:fedId` returns full structure (teams, divisions) for any federation
- **Negotiations**: Tabs split active/history; retry button on rejected negotiations calls `startNegotiation` directly
- **Palmarés**: computed from `seasonRecords` (league + cup champions) in `getTeam()`, displayed as trophy cards
- **TeamsPage**: Tabs split "Mi federación" (grouped by division) vs "Otras federaciones" (grouped by federation)
