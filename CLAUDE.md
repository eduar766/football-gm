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
pnpm typecheck                  # turbo run typecheck (all packages)
pnpm test                       # engine vitest + fast-check
pnpm lint

# Run a single test file
pnpm --filter @football-gm/engine test -- test/cups.test.ts
pnpm --filter @football-gm/engine test -- test/golden.test.ts --update   # update golden snapshot

# Database (drizzle-kit, from apps/backend or via --filter)
pnpm --filter @football-gm/backend db:generate            # generate migration from schema changes
pnpm --filter @football-gm/backend db:migrate             # apply migrations
```

### Testing strategy

Three distinct test types in `packages/engine/test/`:

- **Golden master** (`golden.test.ts`) — runs 6 seasons with seed 777 and compares `state.history` to a snapshot. If engine logic changes observable outputs, this test fails intentionally. Review the diff carefully before rerunning with `--update` to accept.
- **Property-based** (`invariants.test.ts`) — uses `fast-check` over random seeds to assert structural invariants. Failures indicate broken invariants, not just changed numbers.
- **Unit tests** (one file per engine module: `cups.test.ts`, `economy.test.ts`, `norms.test.ts`, etc.) — scenario-driven tests for specific engine functions.

`advanceSeason(state)` is an exported engine helper that loops `advanceMatchday` until the season ends or a pending event blocks it. Tests use it to simulate full seasons in one call. The HTTP backend uses `advanceMatchday` for the per-matchday `POST /games/:id/advance` endpoint — these are different.

## Ports

| Service  | URL                     | Notes                                   |
|----------|-------------------------|-----------------------------------------|
| Frontend | http://localhost:5290   | **Open this in the browser**            |
| Backend  | http://localhost:3000   | Routes under `/games/...`, `/auth/...`, `/admin/...` |
| Postgres | localhost:**5544**      | Docker (`5544:5432` to avoid clashing with a local Postgres on 5432) |

The frontend reads `VITE_API_URL` (default `http://localhost:3000`) from `apps/frontend/.env.local`.

The backend reads from `apps/backend/.env` (see `.env.example`):

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5544/football_gm` |
| `JWT_SECRET` | Yes | Random string ≥ 32 chars — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_EMAIL` | Yes | Initial admin account email |
| `ADMIN_PASSWORD` | Yes | Initial admin account password (change on first login) |
| `RESEND_API_KEY` | No | Transactional emails (password reset, access requests). Leave empty for dry-run (logs to console) in dev |
| `APP_URL` / `FRONTEND_ORIGIN` | No | Default `http://localhost:5290`. Used in email links and CORS header |
| `PORT` | No | Default `3000` |

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

### Forward-compatibility and schema migrations

`GameStateRepository.loadState()` calls `migrateState(state)` automatically after deserializing. `migrateState` is the single place for all structural GameState patches; `CURRENT_SCHEMA_VERSION` in `migrations.ts` is the authoritative version number.

**When you add a new field to `GameState`:**
1. Add it to `types.ts` as optional or with a default.
2. Add a migration patch in `migrations.ts` under the current or a new version bump:

```ts
if (!state.newField) state.newField = defaultValue;
```

Do **not** add ad-hoc defaults in `loadState()` — all backward-compat patches live in `migrations.ts`.

### RNG determinism — never mix the three RNGs

`GameState` has **three independent RNG streams**:
- `state.rng` — drives the match engine, norms, events, cups, negotiations, headlines, etc.
- `state.rivalRng` — drives rival league simulation only (used exclusively in `rival-sim.ts`).
- `state.mandatesRng` — independent stream for board mandate generation (seeded from game seed via XOR constant).

These must never cross. Player-league simulation uses `state.rng`; anything in `rival-sim.ts` uses `state.rivalRng`; mandate generation uses `state.mandatesRng`. This keeps the golden snapshot deterministic.

### Core entity model

```
Confederation  →  Federation  →  Division  →  Team  →  Player
Federation     →  Cup/Tournament
Season         →  Matchday     →  Match (2 teams)
```

Key modeling invariants:
- **Federation is one entity type** — player's and rivals' share the same model; distinguished by `isPlayer`. Rivals use the same tier/prestige rules.
- **Nothing is hard-deleted** — a team leaving a league re-associates to a new `federationId`, never deleted.
- **History is append-only** — `seasonRecords`, `trajectories`, `seasonChronicles`, and `awards` are written once at season close; palmarés and rankings are derived from them, never stored separately.
- **Tier is derived** — never stored; always computed from prestige via `tierOf()` in the engine.
- **Divisions carry `federationId`** — player's divisions have `federationId = playerFederationId`; rival federations have their own divisions.
- **Division contamination guard** — all backend DB operations filter by `federationId === playerFederationId` when querying player-only data.

### Key types (packages/engine/src/types.ts)

- `GameState` — the full serializable simulation state. Has `schemaVersion: number` used by the migration system.
- `SeasonPhase` — `'pretemporada'` (setup window) | `'temporada'` (playable).
- `CupFormat` — `'eliminatoria'` | `'eliminatoria_ida_vuelta'` | `'liga'`.
- `NormType` — `'tope_plantilla' | 'minimo_competitivo' | 'tope_salarial' | 'tope_extrangeros' | 'minimo_cantera' | 'tope_edad_media' | 'tope_deficit'`.
- `NegotiationState` — `'gathering_requirements' | 'offer' | 'accepted' | 'effective' | 'rejected'`.
- `NegotiationRequirement` — `{ tipo: 'prestigio'|'estadio'|'reparto', objetivo, cumplido, revealed }`. Requirements are revealed one per season during `gathering_requirements`; acceptance requires ≥75% of revealed reqs met.
- `BoardMandate` — `{ id, objetivo, target, deadline, met, year }`. One mandate per season; 2 consecutive failures reduce impulses.
- `MatchReport` — `{ matchday, divisionOrden, homeId, awayId, homeGoals, awayGoals, goalscorers, homeYellowCards, awayYellowCards, homeRedCards, awayRedCards }`. Stored in `state.matchReports[]`.
- `RecordBook` — `{ biggestWin, longestWinStreak }`. Accumulated in `state.recordBook` at each `closeSeason`.
- `FederationCoefficient` — `{ federationId, name, cumulativeScore, lastRank, seasonsRanked }`. Stored in `state.federationCoefficients`.
- `SeasonChronicle` — narrative summary written at `closeSeason` (champion, best player, revelation, disappointment).
- `Headline` — short narrative fact derived from match results/history (rachas, goleadas, sorpresas).
- `Rivalry` — pair of teams detected as rivals from trajectory history (contiguous positions over N seasons).
- `CupTemplate` — blueprint for recurring cups; saved at `closeSeason`, recreated in `pretemporada`.
- `Player` — has `nationality: string` (`'local'`/`'extranjero'`) and `cantera: boolean` used by norm breach checks, plus a hidden `potencial` consumed by the talent pipeline.
- `BoardConfidence` — `{ value (0-100), history }`. Evaluated at `closeSeason`; when a losing condition is met, `state.gameOver` (`{ reason: GameOverReason, year, message }`) is set. The engine only sets the flag — it does not early-return the season loop, so tests and the golden master keep running; the backend refuses to advance once `gameOver` is set.
- `ClubDemand` — `{ id, teamId, type: 'rescate'|'inversion_estadio', deadlineMatchday, amount, resolved, satisfied }`. A club in crisis *asks* the commissioner for help instead of the commissioner acting unprompted; ignoring a demand erodes `arraigo` and chronic low arraigo triggers exodus.
- `MailboxMessage` — `{ id, category, title, body, status, actionKind, refId, deadlineMatchday }`. Unified commissioner inbox over events, mandates, and club demands (`state.mailbox`).
- `FederationLogEntry` — append-only narrative timeline of the player's federation (sponsorships, negotiations, rescues, sanctions, mandate results, titles), stored in `state.federationLog`. Domain ledgers (`rescueLog`, `history`, `transfers`) remain the source of truth per-domain; this is the human-readable stream across all of them.
- `FeaturedReport` / `FeaturedMoment` — pure derivation (no new state) that builds a rich goal-by-goal chronology for the handful of matches worth reading about (derbi, title race, goleada, remontada, hat-trick). Scoped to league `MatchReport`s only, since cup matches don't store per-goal detail.

### Backend architecture

The `game/` module controllers are split by domain to keep files manageable:

| Controller | Routes | Responsibility |
|------------|--------|----------------|
| `game.controller.ts` | `POST /games`, `GET /games`, `GET /games/:id`, `DELETE /games/:id` | Core CRUD |
| `season.controller.ts` | `POST /games/:id/start-season`, `POST /games/:id/advance`, `POST /games/:id/close-season` | Season lifecycle |
| `competition.controller.ts` | `GET /games/:id/structure`, cups, own team | League structure & cups |
| `economy.controller.ts` | Commercial actions | Revenue & spending |
| `governance.controller.ts` | Norms, sanctions | Governance actions |
| `negotiation.controller.ts` | Negotiation lifecycle | Adhesion negotiations |
| `history.controller.ts` | Records, trajectories, chronicles | Read-only history |
| `io.controller.ts` | `GET /games/:id/export`, `POST /games/import` | Save file export/import |
| `mailbox.controller.ts` | `GET /games/:id/mailbox`, mark read/read-all, `POST /games/:id/demands/:demandId/resolve` | Commissioner inbox & club demands |

All game routes are guarded by `JwtAuthGuard` + `GameOwnerGuard`. Admins bypass ownership checks.

**Auth system** (`auth/`):
- JWT-based; token issued at `POST /auth/login` and sent as `Authorization: Bearer` on every request.
- Rate limiting: 5 login attempts per 15 minutes per IP (brute force protection via `@nestjs/throttler`).
- `POST /auth/request-access` → sends approval email to admin; `POST /auth/reset-password`, `POST /auth/change-password`.
- `AdminGuard` restricts `GET /admin/requests`, `POST /admin/requests/:id/approve`, etc. to admin users.
- Email delivery via Resend (`email/email.service.ts`). If `RESEND_API_KEY` is unset, emails are logged to the console (dry-run mode — safe for local dev).

**DB schema** (`db/schema.ts`) — Drizzle ORM table definitions. `game_engine_states` holds the JSONB blob; all other tables are read/history projections written at season close.

**GameStateRepository** (`game/game-state.repository.ts`):
- Owns all `loadState` / `saveState` operations.
- Calls `migrateState()` automatically on every load — no callers need to worry about schema version.

**World generator** (`game/world-generator.ts`):
- Deterministic: same seed → same world (uses the engine's Mulberry32 PRNG).
- Generates full player squads, team attributes, and rival team rosters at game creation.
- Runs once; the engine then owns its own RNG stream.

### Contracts (packages/contracts/src/index.ts)

Single source of truth for the back/front contract. Backend validates incoming requests with Zod via `ZodValidationPipe`; frontend infers its types from the same schemas. No separate type definitions.

### Frontend routing

Uses TanStack Router with file-based-style routes in `apps/frontend/src/routes/`. `GameLayout.tsx` is the shell for all in-game pages — it carries the phase chip, sidebar navigation with urgency badges (pending events, norm breaches), and stat pills. `GamesPage.tsx` is the lobby (list/create/export/import games).

Auth pages (`LoginPage`, `RequestAccessPage`, `ResetPasswordPage`, `ChangePasswordPage`) sit outside `GameLayout` and don't require authentication. `AdminPage` is behind `JwtAuthGuard` + `AdminGuard`.

In-game pages: `DashboardPage`, `TeamsPage`, `TeamDetailPage`, `FederationsPage`, `FederationPage`, `NegotiationsPage`, `CupsPage`, `NormsPage`, `EventsPage`, `EconomyPage`, `PrizesPage`, `HistoryPage`, `StructurePage`, `MarketPage`, `TransfersPage`, `WorldPage`, `MailboxPage`.

All API calls go through `apps/frontend/src/api.ts` — a typed fetch wrapper that automatically attaches the JWT token from `localStorage`.

### Engine module responsibilities

| Module | Responsibility |
|--------|---------------|
| `engine.ts` | `createGame`, `startSeason`, `advanceMatchday`, `closeSeason` — the main season loop; mandate generation/check; record book; federation coefficients |
| `season-pipeline.ts` | `closeSeason` internals: an ordered array of `CloseSeasonStep`s (each `{ priority, run }`) executed ascending by priority, sharing a `SeasonCloseContext`. Adding a season-close system means pushing one step with a free priority slot — no edits to existing steps. Replaced a ~300-line monolith; the extraction preserved the golden master exactly. |
| `match.ts` | `simulateMatch` — Poisson-distributed goals, cards, goalscorers; appends to `state.matchReports` |
| `fixtures.ts` | `generateFixtures` — double round-robin via circle method with Fisher-Yates shuffle for variety per season |
| `structure.ts` | League structure helpers: `competingTeams`, `teamsInDivision`, `pendingIntegrationTeams`, `MAX_DIVISION_SIZE`, `PROMOTION_RELEGATION`, `divisionName` |
| `migrations.ts` | `migrateState(state)` — brings any serialized `GameState` up to `CURRENT_SCHEMA_VERSION` (currently 14). Called once per load in `GameStateRepository`. |
| `economy.ts` | Commercial contracts, revenue, costs, `processEconomy` at season close; offer-value deductions from negotiations |
| `negotiation.ts` | Negotiation lifecycle, requirements generation/reveal/check, rival poach attempts, `poachCooldowns` |
| `norms.ts` | Norm creation, breach detection, `valorActual()`, `governanceBonus()` |
| `events.ts` | Event spawning (including chained arcs via `chainedFromId`), resolution, type-specific consequences |
| `cups.ts` | Cup creation, scheduling, `playCupRound`, two-leg aggregate logic, participant management |
| `rival-sim.ts` | `simulateRivalLeagues`, `driftRivalStrengths`, `updateRivalPrestige`, `runRivalNegotiations` |
| `headlines.ts` | `generateHeadlines`, `buildChronicle`, `detectRivalries` — narrative layer from match results and history |
| `featured.ts` | `FeaturedReport`/`FeaturedMoment` — pure, no-new-state derivation of a rich goal-by-goal chronology for the handful of matches worth reading about (derbi, título, goleada, remontada, hat-trick). League matches only (needs per-goal `MatchReport` detail). |
| `awards.ts` | Individual awards (MVP, top scorer, best young player) at season close |
| `prizes.ts` | Prize pools, share calculation, `processLeaguePrizes` |
| `salaries.ts` | Player salary simulation and salary cap logic |
| `standings.ts` | Table computation, rivalry detection from trajectories |
| `transfers.ts` | Pre-season transfer window simulation |
| `talent.ts` | Youth development pipeline: hidden `potencial` generation, role-aware growth, youth intake, retirement. Uses its own `talentRng`-derived stream; gated on `players.length > 0` so player-less golden-master runs are unaffected. |
| `prestige.ts` | Structural prestige base (never stored, same precedent as `tierOf()`) from team count, infrastructure, governance streak, coefficient rank, and cup tradition. `closeSeason` regresses `state.prestige` toward this base each season (`PRESTIGE_REGRESSION_K`) so one great/bad season can't permanently swing it. |
| `board.ts` | Board confidence meter (0–100) evaluated at `closeSeason`; sets `state.gameOver` on a losing condition (destitution, quiebra, éxodo, mandatos fallidos, liga vacía). No RNG — golden-stable. |
| `demands.ts` | Club-initiated requests (rescue, stadium investment) — a club in crisis *asks*, rather than the commissioner acting unprompted. Ignoring a demand erodes `arraigo`; chronic low arraigo triggers exodus. Uses `eventsRng`, not `state.rng`. |
| `mailbox.ts` | `pushMail`/`markMailRead`/`markAllMailRead` — unified commissioner inbox over events, mandates, and club demands. Pure, no RNG. |
| `federation-log.ts` | `logFederation()` — append-only narrative timeline of the player's federation, written at the call sites where the underlying facts already happen. |
| `names.ts` | Shared name pools + deterministic generators for teams, federations, and youth-intake players. Takes an `RngState` so callers control determinism. |
| `preseason.ts` | `preseasonChecklist()` — derives blocking/non-blocking pretemporada items (prizes configured, distribution set, etc.). The engine itself stays permissive; the backend enforces blockers before advancing the phase. |
| `seed-data.ts` | UEFA seed data: 7 federations, 132 real teams |
| `rng.ts` | Mulberry32 PRNG — deterministic, serializable as a single `u32` |

### Dev build-order gotcha

`engine`/`contracts` must have their `dist/` built before the backend typechecks. `turbo.json` handles this via `dependsOn: ["^build"]` in the `dev` task. The tsup watcher uses `clean: !options.watch` so it does **not** wipe `dist/` on start.

If you see `TS7016: Could not find a declaration file`, run `pnpm build` once, then `pnpm dev`.

## Key game mechanics (current implementation)

- **Prestige & tiers (1–5):** prestige is the main score; tier gates which teams you can negotiate with.
- **Snowball brakes:** two-year adhesion delay, tier gate, team `arraigo` (loyalty, 0–100), financial tension, reactive rival federations.
- **Negotiation lifecycle:** tier check → requirements gathering (1–3 seasons, one req revealed per season) → offer (with `offerValue` % revenue share) → accepted → effective two years after acceptance. Acceptance requires ≥75% of revealed requirements met. Rejection triggers 1-season `poachCooldown`.
- **Board mandates:** one per season generated at `startSeason` (prestige target, team count, revenue, etc.). Two consecutive failures reduce impulses by 1.
- **Impulses:** limited per-season "thumb on the scale" actions that favor one team. Also spendable as `callReview` (max 2/season, costs −1 prestige each).
- **Governance bonus:** norms that are enforced and met give +1/+2 prestige at `closeSeason` via `governanceBonus()`.
- **Rival agency:** rival federations invest in weak teams (6.1), respond selectively when robbed (6.2), negotiate with each other (6.3), and maintain prestige as a separate slow-moving inertial value from strength (6.4).
- **Narrative layer:** `headlines.ts` generates short facts from each season's results; `buildChronicle` writes a season summary. Both appear in the Dashboard.
- **Record book:** `state.recordBook` tracks biggest win margin and longest win streak across all seasons. Updated at each `closeSeason`.
- **Federation coefficients:** `state.federationCoefficients` accumulates each federation's global ranking score over time. Visible in Federations → "Ranking Mundial" tab.
- **Export/import:** full `GameState` serialized as JSON (download/upload from the Games lobby).
- **Team autonomy:** teams manage their own squads. The player never signs players for a club.
- **Commissioner inbox:** `state.mailbox` unifies events, board mandates, and club demands into one triaged list (`unread`/`read`/`resolved`/`expired`). `MailboxPage` + `mailbox.controller.ts`.
- **Club demands:** clubs in crisis (treasury below threshold, stadium capacity needs) *ask* the commissioner for help rather than the commissioner acting unprompted. Ignoring a demand erodes `arraigo`; deadlines are matchday-based.
- **Board confidence & game over:** a 0–100 confidence meter moves with mandate outcomes, prestige swings, and treasury health; five losing conditions (`GameOverReason`) can end the game at `closeSeason`. The engine only flags `state.gameOver` — the backend refuses to advance a game that has it set.
- **Structural prestige base:** a derived (never stored) floor/ceiling computed from team count, infrastructure, governance streak, federation-coefficient rank, and cup tradition. `closeSeason` regresses `state.prestige` toward this base every season so no single season can permanently inflate or collapse it.
- **Youth development pipeline:** hidden per-player `potencial`, role-aware growth, youth intake, and retirement — all on a dedicated `talentRng` stream, gated so player-less runs (golden master) never touch it.
- **Featured matches:** a handful of league matches per season (derby, title race, blowout, comeback, hat-trick) get a rich goal-by-goal narrative built on demand from existing `MatchReport` data — no extra state or RNG.
- **Recurring cups:** `Cup.recurring: boolean`; templates saved in `closeSeason()`, recreated in `pretemporada`. Participant lists are editable via `EditCupParticipantsRequest`. Deduplication runs at `migrateState` v2 for saves affected by the double-template bug.
- **Two-leg cups:** `'eliminatoria_ida_vuelta'` format; `computeTwoLegWinner()` resolves via aggregate → away goals → penalties.
- **Match reports:** every simulated match appends a `MatchReport` to `state.matchReports` (matchday, goals, goalscorers, cards). Used by history and dashboard views.

## CI/CD

**GitHub Actions** (`.github/workflows/`):
- `ci.yml` — runs on push/PR to `main`: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm audit`. Must pass before merging.
- `deploy.yml` — placeholder triggered on push to `main`. Configure after choosing a host (Fly.io, Render, Railway, etc.). Required secrets: `JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `FRONTEND_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

**Docker** — Dockerfiles for both apps + nginx config are present for container-based deployments.

## Adding a new game action (checklist)

1. Add pure function to the relevant engine module (takes + returns `GameState`).
2. Export it from `packages/engine/src/index.ts`.
3. Add request/response Zod schemas to `packages/contracts/src/index.ts`.
4. Add the endpoint to the appropriate controller under `apps/backend/src/game/` (pick the one matching the domain, or `game.controller.ts` for new categories). Auth is automatic — all game routes already carry `JwtAuthGuard` + `GameOwnerGuard`.
5. Implement the `db.transaction(loadState → engine fn → saveState)` flow in `game.service.ts`.
6. Add the API call to `apps/frontend/src/api.ts`.
7. Wire up `useMutation` in the relevant frontend page.
8. Add engine tests in `packages/engine/test/`.
9. If you added a new field to `GameState`, add the migration patch in `packages/engine/src/migrations.ts` (bump `CURRENT_SCHEMA_VERSION` if it's a breaking structural change).
