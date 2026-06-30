# Football GM — Plan maestro

> Documento de referencia para retomar el contexto en cualquier sesión futura.
> Si no sabes por dónde empezar, lee aquí primero.

---

## Qué es esto

Simulador de gestión de **ligas de fútbol** inspirado en Total Extreme Wrestling.
El jugador es el **comisionado** (no el entrenador ni el DT): dirige una competición
y la hace crecer hasta ser de talla mundial. Los equipos son autónomos — fichan y
se gestionan solos. El comisionado fija normas, aplica sanciones, gestiona
patrocinadores y decide con qué equipos negocia para que se unan.

**Stack:** NestJS · Drizzle ORM · PostgreSQL 16 · React + Vite · Mantine · TanStack Router/Query · Zod · TypeScript.  
**Monorepo:** pnpm + Turborepo. Packages: `engine` (puro, sin I/O), `contracts` (Zod), `config`.

---

## Estado actual: qué está implementado

### Motor del juego (engine)

| Módulo | Estado | Notas |
|--------|--------|-------|
| Ciclo de temporada (`engine.ts`) | ✅ | `createGame → startSeason → advanceMatchday → closeSeason` |
| Motor de partidos (`match.ts`) | ✅ **v2** | √-compresión, forma, fatiga, home-advantage por estadio, disponibilidad |
| Goleadores reales (`awards.ts`) | ✅ | `attributionRng` independiente; goleadores ponderados por posición × calidad |
| Economía federación (`economy.ts`) | ✅ | Contratos comerciales, coste operativo, merchandise, reparto |
| Economía de equipos (`economy.ts`) | ✅ **NUEVO** | Taquilla (90%), patrocinadores autónomos, P&L por equipo, rescate |
| Transferencias (`transfers.ts`) | ✅ | Ventana pre-temporada; actualiza tesorería del club inmediatamente |
| Norms & sanciones (`norms.ts`) | ✅ | 7 tipos incl. `tope_deficit` (FFP); escalado por reincidencia |
| Premios por competición (`prizes.ts`) | ✅ | Pool + reparto por posición; premios retenibles (rescate) |
| Copas (`cups.ts`) | ✅ | Eliminatoria / ida&vuelta / liga; recurrentes; cupsRng independiente |
| Negociaciones de adhesión (`negotiation.ts`) | ✅ | Requisitos graduales, cooldown, oferta con % reparto |
| Mandatos de la junta (`engine.ts`) | ✅ | Objetivo por temporada; 2 fails → −1 impulso |
| Rivales (`rival-sim.ts`) | ✅ | 132 equipos UEFA reales; inversión, represalia, coeficientes mundiales |
| Narrativa (`headlines.ts`) | ✅ | Titulares + crónica de temporada |
| Impulsos / callReview (`engine.ts`) | ✅ | "Pulgar en la balanza"; callReview −1 prestige |
| Eventos / polémicas (`events.ts`) | ✅ | Spawn aleatoria; arcos encadenados |
| Forma reciente (`engine.ts`) | ✅ **NUEVO** | `team.recentForm` últimos 5 resultados; `matchesPlayedThisSeason` |
| Salarios (`salaries.ts`) | ✅ | Masa salarial calculada desde calidad del plantel |
| Clasificaciones / rivalidades (`standings.ts`) | ✅ | |
| Migraciones de estado (`migrations.ts`) | ✅ | `schemaVersion` v3; forward-compat automático al cargar |
| RNG deterministico | ✅ | 3 streams independientes: `rng`, `rivalRng`, `mandatesRng` |

### Backend

| Área | Estado |
|------|--------|
| Auth JWT + throttling + CORS + Helmet | ✅ |
| GameOwnerGuard + SELECT FOR UPDATE | ✅ |
| GameStateRepository (memoización por transacción) | ✅ |
| Controllers por dominio (economy, season, competition…) | ✅ |
| Endpoint `GET /games/:id/economy/teams` | ✅ **NUEVO** |
| Endpoint `POST /games/:id/economy/rescue` | ✅ **NUEVO** |
| Export/Import JSON save | ✅ |
| GDPR: hard-delete, purga programada | ✅ |
| CI (GitHub Actions: build + typecheck + lint + test + audit) | ✅ |
| Dockerfiles + nginx + health endpoint | ✅ |

### Frontend

| Área | Estado |
|------|--------|
| GameLayout con sidebar + urgency badges | ✅ |
| DashboardPage (mandato, titulares, crónica, jornadas rivales, match reports) | ✅ |
| EconomyPage (federación + **finanzas de equipos** + tabla rescates) | ✅ **NUEVO** |
| NormsPage (7 tipos incl. `tope_deficit` FFP) | ✅ **NUEVO** |
| TeamsPage / TeamDetailPage | ✅ |
| CupsPage / HistoryPage / TransfersPage | ✅ |
| NegotiationsPage / EventsPage / PrizesPage | ✅ |
| WorldPage (standings en vivo de ligas rivales) | ✅ |
| StructurePage / MarketPage / FederationsPage | ✅ |
| AuthPages (login, solicitud acceso, reset) + AdminPage | ✅ |
| BracketView, PageHero, EconomyChart (componentes compartidos) | ✅ |
| Lazy loading de rutas + code splitting | ✅ |
| Testing (vitest + testing-library, 23 tests frontend) | ✅ |

---

## Lo hecho en esta sesión (29 Jun 2026)

### Fase 1 — Economía de equipos

**Engine** (`types.ts`, `economy.ts`, `norms.ts`, `prizes.ts`, `transfers.ts`, `engine.ts`, `migrations.ts`):

- `Team` extendido: `treasury`, `sponsors[]`, `lastTeamEconomy`, `prizesWithheld`, `recentForm`, `matchesPlayedThisSeason`
- `GameState` extendido: `rescueLog[]`, `nextTeamSponsorId`
- `NormType` añade `'tope_deficit'` (FFP): rompe si `treasury < -norm.valor`
- `autoNegotiateTeamSponsors()` — en `startSeason`; 1-2 sponsors por equipo, años variables
- `processTeamEconomies()` — en `closeSeason`; calcula P&L completo por equipo (taquilla 90%, sponsors, premios, transfers, salarios, infra); inversión autónoma en estadio y academia
- `rescueTeam()` — inyecta capital de la tesorería federativa; opción de retener premios futuros
- `payLeaguePrize` / `payCupPrize` — omiten equipos con `prizesWithheld = true`
- Transfers actualizan `treasury` del comprador/vendedor inmediatamente
- `advanceMatchday` — registra `recentForm` y `matchesPlayedThisSeason` tras cada partido
- Migración v2→v3 — inicializa todos los nuevos campos en saves antiguos

**Contracts** — `tope_deficit` en NormType, `AddNormRequest` validación, `TeamSponsorDto`, `TeamSeasonEconomyDto`, `TeamFinancialSummary`, `TeamEconomiesResponse`, `RescueTeamRequest`

**Backend** — `GET :id/economy/teams`, `POST :id/economy/rescue` en `economy.controller.ts`; `getTeamEconomies()` y `rescueTeam()` en `game.service.ts`

**Frontend** — sección "Finanzas de equipos" en `EconomyPage.tsx`: tabla con tesorería, salud financiera, forma reciente, P&L última temporada, patrocinadores, botón rescate + modal; historial de rescates; `tope_deficit` en `NormsPage.tsx`

### Fase 2 — Motor de partidos realista

**Engine** (`match.ts`):

- **Fórmula √-comprimida**: `homeXg = 0.45 + 2.1 × √homeRating / (√home + √away)` — elimina resultados extremos (6-0 de equipo 85 vs 40 era posible al 0.1%; ahora < 0.01%)
- **Home advantage variable**: `4 + min(3, capacity/40_000 × 3)` — estadios grandes dan más ventaja
- **Modificador de forma**: ±4 puntos según últimos 5 resultados
- **Modificador de fatiga**: −1 por cada 12 partidos jugados en la temporada (max −3)
- **Modificador de disponibilidad**: −hasta 8 puntos si jugadores clave están lesionados/suspendidos (ponderado por calidad)
- Goleadores reales — ya funcionaban vía `attributionRng`; no cambia el mecanismo
- Snapshot golden actualizado (seed 777, 6 temporadas)
- `simulateMatch(home, away, rng, favoredTeamId?, players?)` — `players` opcional; cups/rival-sim usan el default `[]` sin cambiar su firma

---

## Lo que falta

### Completado en sesión 30 Jun 2026 — Alta prioridad

- **TeamDetailPage "Finanzas"** ✅ — tab con tesorería, salud financiera, P&L última temporada, patrocinadores activos. `finance` field añadido a `TeamDetail` en contracts; `getTeam()` lo rellena desde engine state.
- **Calidad influenciada por finanzas** ✅ — en `processTeamEconomies()`: si `treasury < 0` tras cierre, `strength` cae 1-3 puntos (1 si apenas en negativo, 2 si >1×wageBill en deuda, 3 si >2×). Mínimo 20.
- **Copa Inter-Ligas** ✅ — `createInterLeagueCup()` en cups.ts; requiere `prestige >= 50`, `CupType = 'inter_ligas'`; usa campeones reales de `rivalSeasonRecords` (IDs positivos en `s.teams`); backend `POST /games/:id/cups/inter-league`; form en CupsPage con multiselect de federaciones rivales.
- **Informes del Comisionado** ✅ — `GET /games/:id/commissioner-reports`; nueva tab "Informes del Comisionado" en WorldPage con tabla de todas las federaciones (prestige, último campeón, top goleador, coeficiente de poder).

### Prioridad alta — gameplay (pendiente)

- **Transferencias inter-ligas** — las transferencias ya ocurren entre equipos de la liga del jugador, pero los equipos rivales (otros federaciones) no participan. `rival-sim.ts` tiene `runRivalNegotiations` pero no vincula con el mercado del jugador.

### Prioridad media — calidad de juego

#### D. Importancia del partido

El motor de partidos (`match.ts`) tiene un TODO pendiente: los partidos de final de temporada (última jornada, luchando por el título o el descenso) deberían tener ligera presión extra. Se necesita saber el contexto (posición actual, puntos de distancia al líder/descenso). Requiere pasar `standings` o una señal de importancia al `simulateMatch`.

#### E. Lesiones con realismo

Actualmente las lesiones (`injuredMatchesLeft`) ocurren con probabilidad fija `INJURY_PROB = 0.03` y duran 1-4 partidos. Se podría:
- Escalar probabilidad con fatiga (más partidos → más lesiones)
- Lesiones más largas para jugadores de alta calidad (codicia de medios)
- Mostrar lesionados en TeamDetailPage con tiempo de recuperación estimado

#### F. Forma en rivals

`team.recentForm` se actualiza para equipos del jugador en `advanceMatchday`. Los equipos rivales (en `rival-sim.ts`) no actualizan su forma porque usan `stepRivalMatchdays`. Si se quisiera que los rivales también tengan efecto de forma, habría que actualizar `recentForm` en `stepRivalMatchdays`.

### Prioridad baja — producción

#### G. Producción pendiente (de PLAN-PRODUCCION.md)

Los items ✅ del plan de producción están hechos. Los que quedan:

| Item | Esfuerzo | Descripción |
|------|----------|-------------|
| 3.3 Batch inserts en createGame | M | 150+ INSERTs uno a uno; usar `INSERT INTO ... VALUES (...)` en array |
| 3.4-3.7 Indexes + constraints | S | Indexes faltantes, UNIQUE en columnas link, CHECK constraints, pgEnum |
| 3.8 Paginación listTeams/getHistory | S | Sin límite; agregar limit/offset |
| 4.1 Lazy loading rutas | S | Solo EconomyPage e HistoryPage son lazy; convertir todo |
| 4.2 Constants + ApiError | S | TOKEN_KEY y API_URL repetidos en 3 ficheros; crear ApiError class |
| 4.5 Route map en GameLayout | S | Ternario de 14 niveles; extraer a objeto ROUTES |
| 4.8 Tests frontend adicionales | M | 5 pruebas de alto valor (req() 401, GameLayout tab, BracketView…) |
| 5.5 Logging estructurado | M | Reemplazar console.log por Logger NestJS; Sentry/similar en prod |
| 5.6 Runbook migración BD prod | S | Backup → migrate → verify; CREATE INDEX CONCURRENTLY |

---

## Reglas de desarrollo (NO cambiar)

### RNG — nunca mezclar los tres streams

```
state.rng          → motor de partidos, normas, eventos, copas-player, negociaciones
state.rivalRng     → ligas rivales ÚNICAMENTE (rival-sim.ts)
state.mandatesRng  → mandatos de la junta
state.attributionRng → goleadores, tarjetas, lesiones (awards.ts)
state.cupsRng      → copas (cups.ts)
state.transfersRng → ventana de transferencias (transfers.ts)
```

Cualquier función nueva que necesite aleatoriedad debe usar el stream correcto según su dominio.

### Migraciones de estado

Al añadir campo nuevo a `GameState`:
1. Añadirlo como opcional en `types.ts`
2. Añadir patch en `migrations.ts` bajo v3 (o bump a v4 si es breaking)
3. NO añadir defaults en `loadState()` — todo en `migrateState()`

### Golden test

Cada cambio al motor de partidos (`match.ts`) o a cualquier función que use `state.rng` cambia el snapshot. Actualizar siempre con:

```bash
pnpm --filter @football-gm/engine exec vitest run --update test/golden.test.ts
```

Revisar el diff antes de aceptar. Un diff razonable son variaciones numéricas en puntos/prestige. Un diff que cambia la estructura de `history` es señal de un bug.

### Patron backend para toda acción mutante

```ts
return this.db.transaction(async (tx) => {
  const state = await this.repo.loadState(gameId, tx);
  const next = engineFn(state, args);
  if (next === state) throw new BadRequestException('...');
  await this.repo.saveState(tx, gameId, next);
  return this.buildResponse(next, ...);
});
```

### Contaminación de divisiones

Todos los endpoints de estructura, clasificaciones y norms filtran por `federationId === state.playerFederationId`. **Nunca** operar sobre equipos rivales desde endpoints de juego del jugador.

---

## Comandos de referencia rápida

```bash
# Arrancar todo
docker compose up -d
pnpm --filter @football-gm/backend db:migrate
pnpm dev

# Tests
pnpm test                                                        # suite completa
pnpm --filter @football-gm/engine test -- test/cups.test.ts     # test unitario
pnpm --filter @football-gm/engine exec vitest run --update test/golden.test.ts  # update snapshot
pnpm typecheck                                                   # sin errores antes de PR

# Build (obligatorio antes de typecheck del backend)
pnpm --filter @football-gm/engine build
pnpm --filter @football-gm/contracts build
```

---

## Puertos

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5290 |
| Backend | http://localhost:3000 |
| Postgres | localhost:5544 |
