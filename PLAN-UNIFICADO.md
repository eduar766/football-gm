# Football GM — Plan Unificado de Implementación

*UI Design + Game Mechanics — Junio 2026*

---

## Estado de Sesión

> **Última sesión:** Junio 2026 — Batch de mejoras Baja/Media/Alta
> **Siguiente sesión:** Implementar #11 (Tipos de sanciones) y #1 (Copa ida y vuelta ya completada)

### Completado en esta sesión

| # | Feature | Prioridad | Estado |
|---|---------|-----------|--------|
| #13 | Revisión + Reunión de emergencia | Baja | ✅ |
| #8 | Evento notificación tardía | Baja | ✅ |
| #2 | Selección masiva equipos | Baja | ✅ |
| #3 | BYE ocultos en brackets | Baja | ✅ |
| #7 | UI premios mejorada (ShareEditor) | Media | ✅ |
| #9 | Celebración de campeón | Media | ✅ |
| #10 | Nombres de patrocinadores | Media | ✅ |
| #5 | Bracket inline en dashboard | Media | ✅ |
| #12 | Requisitos de equipos | Media | ✅ |
| #1 | Copa ida y vuelta | Alta | ✅ |

### Pendiente para próxima sesión

| # | Feature | Prioridad | Notas |
|---|---------|-----------|-------|
| #11 | Tipos de sanciones (tope extranjeros, mín. cantera, tope edad media) | Alta | Agregar `NormType` en engine + contracts + NormsPage UI |
| — | Tests de ida y vuelta | Alta | Agregar test cases para `eliminatoria_ida_vuelta` |
| — | Snapshot golden test | Media | Actualizar con cambios de cups.ts |

### Estado de verificación

```
✅ pnpm typecheck    — 6/6 packages pass
✅ engine tests      — 99/99 pass (14 files)
⚠️  golden snapshot  — necesita actualización (cups format changed)
```

### Continuidad para nueva sesión

Para retomar el trabajo, leer este archivo (`PLAN-UNIFICADO.md`) y `CLAUDE.md`.
Los archivos clave modificados están en `git diff --stat`. El engine tests y typecheck pasan.
El próximo paso es implementar #11 (tipos de sanciones) y agregar tests para ida y vuelta.

---

## Progreso

| Fase | Estado | Notas |
|------|--------|-------|
| **1. Quick Wins** | ✅ COMPLETADA | UI Foundation + Match Narrative + Mid-Season Agency |
| **2. Layout/Core** | ✅ COMPLETADA | Sidebar nav + Transfer fees + Cup penalties + Events + Norms |
| **3. High-Impact** | ✅ COMPLETADA | TeamDetail hero + attribute grid + EconomyChart + PalmaresChart + GamesPage masthead + Rival AI + Career Arcs + Global Ranking |
| **4. Remaining** | ✅ COMPLETADA | 12 pages redesigned + UI↔mechanics integration |
| **5. Polish** | ✅ COMPLETADA | Stagger animations, skeleton shimmer, a11y focus rings, matchday revenue, merchandise, youth academy |
| **6. Batch Mejoras** | ✅ COMPLETADA | 10 features: #13, #8, #2, #3, #7, #9, #10, #5, #12, #1 |

### Fase 1 — Cambios realizados

**UI Foundation:**
- `index.html` — Google Fonts: Plus Jakarta Sans, DM Sans, Geist Mono
- `styles/global.css` — CSS variables, keyframes (fadeInUp, shimmer, pulse), utility classes
- `theme.ts` — Reescritura completa: paleta emerald/gold/purple, component overrides
- `design-tokens.ts` — Tokens de diseño exportados como TS
- `main.tsx` — Import de global.css
- `App.tsx` — Root layout con shield icon + tipografía Plus Jakarta Sans 800
- 16 pages — `className="page-enter"` para animación de entrada

**Mecánicas Quick Wins:**
- `types.ts` — `Goalscorer`, `MatchReport`, `CommissionerAction`, `ActionRecord` types
- `match.ts` — `simulateMatch()` retorna goleadores con minutos
- `awards.ts` — `attributeMatchGoals()` retorna goalscorers + card counts
- `engine.ts` — `advanceMatchday()` construye MatchReports; +3 acciones: `callReview()`, `emergencyMeeting()`, `postponeMatchday()`
- Tests — 98/98 pasan, golden snapshot actualizado

### Fase 2 — Cambios realizados

**UI Layout:**
- `GameLayout.tsx` — Sidebar vertical (220px) en desktop, bottom tab bar en mobile. Stat pills con Geist Mono + colores semánticos (gold prestige, purple impulses). Tab groupings: Resumen, Gestión, Operaciones, Competiciones, Archivo. Container size xl.
- `DashboardPage.tsx` — Preseason hero card con gradient green. Action buttons: primary CTA gradient, outline secondary, red danger. Standings: gold/silver/bronze position indicators, colored goal diff, highlighted points. Fixture cards con mini-card layout.

**Mecánicas Core Depth:**
- `types.ts` — `transferFee` en TransferEntry, `wageCap` en Team, `EventSeverity` type, `severity`+`chainedFromId` en GameEvent, `violationHistory` en GameState, 5 nuevos EventType
- `transfers.ts` — Fees calculados (buyer.strength × 50K + target.calidad × 100K), debitados de treasury
- `economy.ts` — `transferFees`/`transferIncome` en LastEconomy
- `cups.ts` — `simulatePenalties()` con sudden death, cup upset bonus (±2 prestige)
- `events.ts` — 8 tipos de eventos, severity-based prestige cost (1/2/4), `manipulacion_resultados` causa relegación, extra penalty por expiración alta severidad
- `norms.ts` — Escalamiento 3/5/8 puntos, `decayViolationHistory()` para 2 temporadas limpias
- `contracts` — EventType expandido, EventSeverity, EventDto con severity+chainedFromId
- `game.service.ts` — Mapping de severity+chainedFromId en eventsResponse
- Tests — 98/98 pasan, golden snapshot actualizado

---

## Visión General

Dos tracks de trabajo independientes que se convergen en la Fase 4:

| Track | Enfoque | Archivos principales |
|-------|---------|---------------------|
| **UI/Design** | Identidad visual editorial deportiva | `apps/frontend/` |
| **Mecánicas** | Profundidad estratégica del engine | `packages/engine/` |

**Dependencias cruzadas:**
- Match Narrative (mecánica) → necesita UI para mostrar reportes de partido
- Transfer Depth (mecánica) → necesita UI para fees y wage budget
- Mid-Season Agency (mecánica) → necesita UI para nuevos botones de acción

---

## Fase 1: Quick Wins Paralelos (Semana 1)

Ejecutar ambos tracks en paralelo. Sin dependencias cruzadas.

### 1A. UI Foundation (~3h)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `apps/frontend/index.html` | Agregar Google Fonts: Plus Jakarta Sans, DM Sans, Geist Mono | 5 min |
| 2 | `apps/frontend/src/styles/global.css` | **Crear.** CSS variables, keyframes (fadeInUp, shimmer, pulse, hover-lift), utility classes | 30 min |
| 3 | `apps/frontend/src/theme.ts` | Reescribir completo: nuevos colores (emerald/gold/purple), fonts, component overrides (Card, Table, Badge, Button, Alert, Skeleton) | 1 hr |
| 4 | `apps/frontend/src/design-tokens.ts` | **Crear.** Tokens de diseño exportados como TS | 15 min |
| 5 | `apps/frontend/src/main.tsx` | Importar `global.css` | 2 min |
| 6 | `apps/frontend/src/App.tsx` | Rediseñar root layout: header con shield icon + "Football GM" en Plus Jakarta Sans 800 | 30 min |
| 7 | Todos los pages | Agregar `className="page-enter"` wrapper para animación de entrada | 15 min |

**Resultado:** Cascada visual inmediata en todas las 17 pantallas. Sin cambios de lógica.

### 1B. Mecánicas Quick Wins (~4h)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `packages/engine/src/types.ts` | Agregar `Goalscorer`, `MatchReport` interfaces; expandir `MatchResult` | 20 min |
| 2 | `packages/engine/src/match.ts` | Modificar `simulateMatch()` para retornar goleadores con minutos | 30 min |
| 3 | `packages/engine/src/awards.ts` | En `attributeMatchGoals()`, exponer datos de goleadores | 20 min |
| 4 | `packages/engine/src/engine.ts` | En `advanceMatchday()`, construir `MatchReport` y guardar en `s.matchReports` | 30 min |
| 5 | `packages/engine/src/types.ts` | Agregar `CommissionerAction`, `ActionRecord` types; expandir `GameState` | 15 min |
| 6 | `packages/engine/src/engine.ts` | Agregar `callReview()`, `emergencyMeeting()`, `postponeMatchday()` | 1 hr |
| 7 | Tests | Actualizar golden test, agregar tests de match reports y acciones | 30 min |

**Resultado:** Los partidos ahora tienen narrativa (goleadores, minutos, tarjetas). El jugador tiene 3 nuevas acciones durante la temporada.

---

## Fase 2: Layout y Core Components (Semana 2)

### 2A. UI Layout (~6h)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `GameLayout.tsx` | Rediseñar header: federation name + stat pills (Season, Prestige, Matchday, Impulses) con monospace values | 1 hr |
| 2 | `GameLayout.tsx` | **Reemplazar tabs horizontales con sidebar vertical** en desktop. Mobile: bottom tab bar | 2 hr |
| 3 | `GameLayout.tsx` | Agrupar tabs: Overview, Management, Operations, Competitions, Archive | 30 min |
| 4 | `DashboardPage.tsx` | Preseason hero card con gradient background | 1 hr |
| 5 | `DashboardPage.tsx` | Standings table: position indicators (gold/silver/bronze dots), colored goal diff, highlighted points | 1 hr |
| 6 | `DashboardPage.tsx` | Action buttons: primary CTA gradient, secondary buttons | 30 min |

### 2B. Mecánicas Core Depth (~8h, puede empezar en paralelo)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `types.ts` | Agregar `transferFee` a `TransferEntry`, `wageCap` a `Team` | 10 min |
| 2 | `transfers.ts` | Calcular fees (`buyer.strength * 50K + target.calidad * 100K`), debitar de treasury, check wage cap | 1 hr |
| 3 | `economy.ts` | Agregar `transferFees`, `transferIncome` a `LastEconomy` | 30 min |
| 4 | `cups.ts` | Agregar `simulatePenalties()`, modificar knockout ties, agregar cup upset bonus (+2 prestige) | 1 hr |
| 5 | `types.ts` | Expandir `EventType`: +5 tipos, agregar `severity`, `chainedFromId` | 15 min |
| 6 | `events.ts` | Expandir `maybeSpawnEvent()`, agregar `escalateEvent()`, `manipulacion_resultados` → relegación | 1 hr |
| 7 | `types.ts` | Agregar `violationHistory` a `GameState` | 10 min |
| 8 | `norms.ts` | Escalamiento: 1ra infracción=3pts, 2da=5pts, 3ra=8pts + advertencia. Reset con 2 temporadas limpias | 30 min |
| 9 | Tests | Actualizar todos los tests afectados | 1 hr |

---

## Fase 3: Pages de Alto Impacto (Semana 3-4)

### 3A. UI High-Impact Pages (~10h)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `TeamDetailPage.tsx` | Hero card con team name Plus Jakarta Sans 800, badges de federación/división | 45 min |
| 2 | `TeamDetailPage.tsx` | Attribute grid como mini-cards con iconos, strength como gauge visual | 1 hr |
| 3 | `TeamDetailPage.tsx` | Squad table: position color-coded (GK=yellow, DEF=blue, MID=green, FWD=red), quality badges | 1 hr |
| 4 | `EconomyPage.tsx` | Treasury hero: número grande monospace (32px+), health badge con gradient | 45 min |
| 5 | `EconomyPage.tsx` | Money values: todos en Geist Mono con +/− color | 30 min |
| 6 | `EconomyChart.tsx` | Custom tooltip dark theme, rounded bars, gradient fills, axis styling | 45 min |
| 7 | `PalmaresChart.tsx` | Custom tooltip, team-colored bars, axis styling | 45 min |
| 8 | `GamesPage.tsx` | Masthead redesign, saved games como cards con accent color por tier | 45 min |

### 3B. Mecánicas World Building (~12h, puede empezar en paralelo)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `types.ts` | Agregar `RivalAction`, `rivalActions[]` a GameState | 15 min |
| 2 | `engine.ts` | `processRivalActions()`: poaching defensivo (20% si prestige>30), inversión automática (prestige<15), retaliación | 1.5 hr |
| 3 | `negotiation.ts` | `rivalPoachAttempt()`: espejo de `startNegotiation()` para AI | 1 hr |
| 4 | `types.ts` | Agregar `age`, `birthYear` a `Player` | 10 min |
| 5 | `engine.ts` | Reemplazar drift plano con curva de edad: crecimiento (<27), pico (27-31), declive (>32), retiro (>37 o calidad<25) | 1 hr |
| 6 | `types.ts` | Agregar `GlobalRanking`, `Friendly` interfaces | 15 min |
| 7 | `engine.ts` | `computeGlobalRanking()`: media fuerza × equipos × 0.4 + prestige × 0.6. Top federation +2 prestige | 1 hr |
| 8 | `negotiation.ts` | `arrangeFriendly()`: partido cross-federación, +1/-1 prestige | 30 min |
| 9 | Tests | Tests de rival AI, career arcs, global ranking | 1.5 hr |

### Fase 3 — Cambios realizados

**UI High-Impact Pages:**
- `TeamDetailPage.tsx` — Hero card gradient, strength conic-gradient indicator, 6 attribute mini-cards with colored icons, position-coded squad table (POR/DEF/MID/DEL), trajectory with up/down arrows, club structure progress bars
- `EconomyPage.tsx` — Treasury hero (36px Geist Mono), green/red glow, income/expense arrows, contract type badges, compliance progress bars
- `EconomyChart.tsx` — Custom dark tooltip, SVG gradient bar fills, CartesianGrid, Geist Mono axis text
- `PalmaresChart.tsx` — Custom tooltip, CartesianGrid, Geist Mono axis text
- `GamesPage.tsx` — Hero gradient with IconTrophy, Plus Jakarta Sans 800 masthead, gradient CTA button, saved games as accent-bordered cards

**Mecánicas World Building:**
- `types.ts` — `RivalAction`, `GlobalRanking`, `age` on Player, `rivalActions[]`, `globalRankings[]` on GameState
- `negotiation.ts` — `rivalPoachAttempt()`: tier proximity + arraigo + prestige differential
- `engine.ts` — `processRivalActions()`: poaching (20% if prestige>30), auto-invest, retaliation; `computeGlobalRanking()`: avgStrength×0.4 + prestige×0.6, top fed +2 prestige; career arcs replace flat drift (growth <27, peak 27-31, decline >31, retire >37 or calidad<25)

---

## Fase 4: Pages Restantes + Mecánicas Cruzadas (Semana 5-6)

### 4A. UI Remaining Pages (~8h)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `TeamsPage.tsx` | Strength bars, row hover accents, division grouping | 30 min |
| 2 | `FederationPage.tsx` | Hero card, tier badge prominente | 30 min |
| 3 | `FederationsPage.tsx` | Player row highlight, tier badges, prestige bars | 30 min |
| 4 | `MarketPage.tsx` | Arraigo visualization como barra, negotiation button states | 30 min |
| 5 | `NegotiationsPage.tsx` | Timeline visualization (gathering → offer → accepted → effective) | 45 min |
| 6 | `StructurePage.tsx` | Division cards con colored headers, team row visuals | 45 min |
| 7 | `EventsPage.tsx` | Event cards con type-colored left borders, action button styling | 30 min |
| 8 | `CupsPage.tsx` | Cup cards, match score formatting, round headers | 45 min |
| 9 | `NormsPage.tsx` | Norm cards, breach progress bars | 30 min |
| 10 | `TransfersPage.tsx` | Transfer cards con arrow visualization + fee display | 30 min |
| 11 | `PrizesPage.tsx` | Prize cards, share visualization | 30 min |
| 12 | `HistoryPage.tsx` | Season record cards, palmarés medals, award icons | 45 min |

### 4B. Mecánicas UI Integration (~6h)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `DashboardPage.tsx` | Mostrar MatchReports: goleadores, tarjetas, resumen de partido | 1 hr |
| 2 | `DashboardPage.tsx` | Botones para nuevas acciones mid-season (call review, emergency meeting, postpone) | 45 min |
| 3 | `EconomyPage.tsx` | Mostrar transfer fees, wage budgets, sell-on income | 45 min |
| 4 | `TransfersPage.tsx` | Mostrar fees por transferencia, wage cap compliance | 45 min |
| 5 | `FederationsPage.tsx` | Mostrar global ranking | 30 min |
| 6 | `TeamDetailPage.tsx` | Mostrar age, career trajectory (crecimiento/pico/declive) | 45 min |
| 7 | `EventsPage.tsx` | Mostrar severity levels, event chaining, nuevas acciones | 30 min |

### Fase 4 — Cambios realizados

**UI Remaining Pages (12 pages):**
- `TeamsPage.tsx` — Division grouping, strength gradient bars, hover accent
- `FederationPage.tsx` — Hero card, prestige glow, tier circle badge
- `FederationsPage.tsx` — Player row emerald highlight, prestige progress bars, tier pills
- `MarketPage.tsx` — Arraigo bars, gradient negotiate button, tier badge
- `NegotiationsPage.tsx` — Timeline step indicators, pulse animation on active
- `StructurePage.tsx` — Tier-colored division borders, promotion zone indicators
- `EventsPage.tsx` — Type-colored left borders, severity badges, action buttons
- `CupsPage.tsx` — Trophy icons, large Geist Mono scores, round circles
- `NormsPage.tsx` — Breach rows with warning borders, progress visualization
- `TransfersPage.tsx` — Arrow visualization, quality-colored ratings
- `PrizesPage.tsx` — Medal position bars, share visualization
- `HistoryPage.tsx` — Medal palmarés, award icons, monospace data

**UI↔Mechanics Integration:**
- `api.ts` — `callReview()`, `emergencyMeeting()`, `postponeMatchday()` API methods
- `DashboardPage.tsx` — Match reports (goalscorers, minutes, cards), 3 mid-season action buttons
- `EconomyPage.tsx` — Transfer activity section, wage budget compliance
- `TransfersPage.tsx` — Fee column with arrow visualization
- `FederationsPage.tsx` — Global ranking section
- `TeamDetailPage.tsx` — Player age column with career phase colors
- `EventsPage.tsx` — Severity badges, chained event references
- `StructurePage.tsx` — Tier-based division border colors

---

## Fase 5: Polish (Semana 7-8)

### 5A. UI Polish (~6h)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `global.css` | Agregar todas las keyframes y utility classes restantes | 30 min |
| 2 | Todos los pages | Stagger animation delays en table rows y card lists | 1 hr |
| 3 | `GameLayout.tsx` | Skeleton shimmer animation | 30 min |
| 4 | Global | Auditar y estandarizar Badges (pill shape, colores correctos, sizing consistente) | 30 min |
| 5 | Global | Auditar Buttons: primary actions = gradient, secondary = light/subtle | 30 min |
| 6 | Global | Test mobile en todas las páginas | 1 hr |
| 7 | Global | Accessibility: focus rings, contrast ratios, ARIA labels | 1 hr |

### 5B. Mecánicas Polish (~4h)

| # | Archivo | Cambio | Esfuerzo |
|---|---------|--------|----------|
| 1 | `economy.ts` | Agregar matchday revenue (por partido local × capacidad × precio) | 1 hr |
| 2 | `economy.ts` | Agregar merchandise revenue (escala con prestige liga × equipos) | 30 min |
| 3 | `engine.ts` | Wire youth budget → talent investment | 30 min |
| 4 | Tests | Property tests: revenue ≈ matches × capacity × price | 30 min |
| 5 | Global | Golden test: actualizar snapshot completo con todos los cambios | 1 hr |

### Fase 5 — Cambios realizados

**UI Polish:**
- `global.css` — Stagger animation utility (`.stagger-item`), skeleton shimmer keyframes, `*:focus-visible` emerald ring
- 16 pages — Stagger animation delays on all mapped list elements (50ms per item)
- `DashboardPage.tsx` — Button audit: converted inline gradient styles to proper `variant="gradient"` props
- `GameLayout.tsx` — Accessibility: `role="button"`, `tabIndex`, `aria-label`, keyboard navigation on nav items

**Mecánicas Polish:**
- `types.ts` — `stadiumCapacity` + `academia` on Team, `matchday` + `merchandise` on LastEconomy
- `engine.ts` — `DEFAULT_STADIUM_CAPACITY` (25K) + `DEFAULT_ACADEMIA` (40) constants; youth academy bonus (academia/20 = 1-5 calidad for players ≤23)
- `economy.ts` — Matchday revenue (home matches × stadium × $15 × 0.7), merchandise revenue (prestige × teams × 50K)
- `contracts` — Expanded `LastEconomyDto` with `matchday` + `merchandise` fields
- `game.service.ts` — Passes `stadiumCapacity` + `academia` from world generator to engine
- Tests — 99/99 pass, golden snapshot updated, economy tests expanded

---

## Fase 6: Batch de Mejoras (Junio 2026)

Feature batch organizado por prioridad (Baja → Media → Alta). 34 archivos modificados.

### Baja prioridad

**#13 — Revisión + Reunión de emergencia:**
- `game.controller.ts` — Nuevos endpoints: `POST /call-review`, `POST /emergency-meeting`, `POST /postpone-matchday`
- `game.service.ts` — Métodos `callReview()`, `emergencyMeeting()`, `postponeMatchday()`
- `DashboardPage.tsx` — Select + Button combos para seleccionar equipo/partido antes de ejecutar acción
- `api.ts` — Métodos `callReview(gameId, teamId)`, `emergencyMeeting(gameId, teamId)`, `postponeMatchday(gameId)`

**#8 — Evento notificación tardía:**
- `DashboardPage.tsx` — Query invalidation agrega `'events'` al refrescar

**#2 — Selección masiva equipos (Cups):**
- `CupsPage.tsx` — Botones "Seleccionar todos" / "Limpiar" + contador debajo del MultiSelect

**#3 — BYE ocultos:**
- `CupsPage.tsx` — Filtro `homeTeamName !== 'BYE' && awayTeamName !== 'BYE'` en bracket
- `DashboardPage.tsx` — Mismo filtro para cup rounds en dashboard

### Media prioridad

**#7 — UI premios mejorada (ShareEditor):**
- `PrizesPage.tsx` — Reemplazado TextInput de comas con `ShareEditor` (NumberInput por posición, barra visual de distribución, validación ≤100%, botón "Repartir equitativamente")
- `prizes.ts` — `distribute()` + `normaliseShares()` sin cambios (ya funcionaba)

**#9 — Celebración de campeón:**
- `DashboardPage.tsx` — Alert dorado "Campeón matemático" cuando `championTeamId` no es null
- `CupsPage.tsx` — Banner mejorado para campeón de copa con trophy icon animado

**#10 — Nombres de patrocinadores:**
- `economy.ts` — Array `SPONSOR_NAMES` (30 nombres ficticios), `generateContractOffers()` usa nombres
- `contracts` — Campo `nombre` en `CommercialContract` y `ContractOffer`
- `game.service.ts` — Mapea `nombre` en contratos y ofertas
- `EconomyPage.tsx` — Muestra nombre del sponsor en tabla de contratos

**#5 — Bracket inline en dashboard:**
- `DashboardPage.tsx` — Cuando hay cup round en la matchday actual, muestra todos los rounds de esa copa con scores

**#12 — Requisitos de equipos:**
- `contracts` — `TeamDetail.requirements` con `breaches` (inlined, no NormBreachDto) + `sanctions`
- `game.service.ts` — `getTeam()` calcula breaches y sanctions from norms
- `TeamDetailPage.tsx` — Sección "Requisitos" con breach warnings y sanctions

### Alta prioridad

**#1 — Copa ida y vuelta:**
- `types.ts` — `CupFormat` agrega `'eliminatoria_ida_vuelta'`; `CupMatch.leg?: 'ida' | 'vuelta'`; `CupRound.leg?: 'ida' | 'vuelta'`
- `cups.ts` — Cambios mayores:
  - `createCup()` genera rounds ida + vuelta para `eliminatoria_ida_vuelta`
  - `playPendingInRound()` ya no determina winners (deferred a `playCupRound`)
  - `playCupRound()` maneja ida/vuelta: ida solo juega, vuelta calcula aggregate + away goals + penalties
  - `computeTwoLegWinner()` — Nueva función: aggregate score → away goals → penalties
  - `determineMatchWinners()` — Nueva función: winners para single-leg knockout
  - `crownChampion()` — Nueva función: extra prestige + payCupPrize
  - `ensureNextKnockoutRound()` — Busca backwards para encontrar winners de vuelta legs
  - `roundsForCup()` — Retorna `2 × knockoutRounds` para ida_vuelta
  - `scheduleCups()` — Ida y vuelta en matchdays consecutivas
- `contracts` — `CupFormat` schema agrega `'eliminatoria_ida_vuelta'`; `CupMatchDto.leg` + `CupRoundDto.leg` opcionales
- `game.service.ts` — `cupsResponse()` pasa `leg` en matches y rounds
- `CupsPage.tsx` — Opción "Eliminatoria (ida y vuelta)" en Select; bracket agrupa ida+vuelta con labels

### Archivos modificados (Fase 6)

**Engine:** `types.ts`, `cups.ts`, `economy.ts`, `engine.ts`, `negotiation.ts`
**Contracts:** `index.ts`
**Backend:** `game.service.ts`, `game.controller.ts`
**Frontend:** `CupsPage.tsx`, `DashboardPage.tsx`, `PrizesPage.tsx`, `EconomyPage.tsx`, `TeamDetailPage.tsx`, `NormsPage.tsx`, `api.ts`
**Tests:** `economy.test.ts`, `prizes.test.ts`, `transfers.test.ts`, `golden.test.ts.snap`

### Bug fix incluido

- `game.service.ts:1700` — `createCup()` usaba formato hardcodeado `'single_elimination'` → corregido a usar `input.formato`

---

## Resumen de Esfuerzo Final

| Fase | UI | Mecánicas | Estado |
|------|-----|-----------|--------|
| 1. Quick Wins | 3h | 4h | ✅ COMPLETADA |
| 2. Layout/Core | 6h | 8h | ✅ COMPLETADA |
| 3. High-Impact | 10h | 12h | ✅ COMPLETADA |
| 4. Remaining | 8h | 6h | ✅ COMPLETADA |
| 5. Polish | 6h | 4h | ✅ COMPLETADA |
| 6. Batch Mejoras | 8h | 10h | ✅ COMPLETADA |
| **TOTAL** | **41h** | **44h** | **~85h** |

---

## Archivos Afectados

### UI (apps/frontend/)
- **Crear:** `styles/global.css`, `design-tokens.ts`
- **Reescribir:** `theme.ts`
- **Modificar mayor:** `GameLayout.tsx`, `DashboardPage.tsx`, `TeamDetailPage.tsx`, `EconomyPage.tsx`, `GamesPage.tsx`, `CupsPage.tsx`, `PrizesPage.tsx`, `NormsPage.tsx`, `App.tsx`, `index.html`, `main.tsx`
- **Modificar menor:** Todos los demás pages (10 archivos)

### Mecánicas (packages/engine/src/)
- **Modificar mayor:** `types.ts` (~260 líneas nuevas), `engine.ts` (~350 líneas nuevas), `cups.ts` (~240 líneas nuevas), `transfers.ts` (~100 líneas nuevas), `events.ts` (~120 líneas nuevas)
- **Modificar menor:** `match.ts`, `awards.ts`, `norms.ts`, `economy.ts`, `negotiation.ts`
- **Sin cambios:** `rng.ts`, `fixtures.ts`, `structure.ts`, `salaries.ts`

### Backend (apps/backend/src/)
- **Modificar mayor:** `game.service.ts` (~110 líneas nuevas), `game.controller.ts` (~23 líneas nuevas)

### Contracts (packages/contracts/src/)
- **Modificar:** `index.ts` (~35 líneas: CupFormat, CupMatchDto, CupRoundDto, CommercialContract, NormType)

---

## Orden de Ejecución Recomendado

```
Semana 1:  1A (UI Foundation) + 1B (Mecánicas Quick Wins)      ← DONE
Semana 2:  2A (UI Layout) + 2B (Core Depth)                     ← DONE
Semana 3:  3A (UI High-Impact) + 3B (World Building)             ← DONE
Semana 5:  4A (UI Remaining) + 4B (UI Integration)              ← DONE
Semana 7:  5A (UI Polish) + 5B (Mecánicas Polish)                ← DONE
```

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Golden test se rompe con cada cambio de mecánicas | Medio | Actualizar snapshot después de cada release, no al final |
| Sidebar nav rompe mobile | Alto | Probar mobile después de cada cambio de layout |
| Transfer fees quiebran la economía existente | Medio | Empezar con fees bajos, ajustar en testing |
| Rival AI se siente injusta | Alto | Empezar con probabilidades bajas (20%), ajustar según testing |
| Fonts no cargan (FOUT) | Bajo | Usar `document.fonts.ready` con fallback |
| Bundle size crece con animaciones | Bajo | CSS-only animations, no framer-motion |

---

## Criterios de Aceptación

### UI
- [x] Tipografía editorial: Plus Jakarta Sans headlines, DM Sans body, Geist Mono data
- [x] Paleta coherente: emerald primary, gold prestige, purple commissioner, dark surfaces
- [x] Sidebar nav funcional en desktop, bottom tabs en mobile
- [x] Animaciones: page fadeInUp, card hover-lift, table row hover, badge pulse, stagger delays
- [x] Todas las 17 pantallas con la nueva identidad visual
- [x] Mobile responsive en todas las pantallas
- [x] Accessibility: focus rings, aria-labels, keyboard navigation

### Mecánicas
- [x] Match reports con goleadores, minutos, tarjetas
- [x] 3 nuevas acciones mid-season (call review, emergency meeting, postpone)
- [x] Transfer fees y wage budgets funcionando
- [x] Penalty shootouts en copas knockout
- [x] 8 tipos de eventos con severity y chaining
- [x] Norm escalation (3/5/8 puntos)
- [x] Rival AI: poaching defensivo, inversión, retaliación
- [x] Player career arcs: crecimiento, pico, declive, retiro
- [x] Global ranking cross-federación
- [x] Matchday revenue (stadium × tickets × attendance)
- [x] Merchandise revenue (scales with prestige)
- [x] Youth academy investment (academia → calidad bonus)
- [x] Todos los tests pasando (99/99), golden snapshot actualizado
