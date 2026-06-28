# Football GM — Plan Unificado de Implementación

*UI Design + Game Mechanics — Junio 2026*

---

## Estado de Sesión

> **Última sesión:** Junio 2026 — Fase 9: Motor de Rivales + Datos Reales (132 equipos UEFA)
> **Siguiente sesión:** Fase 8 Batch 2 — Narrativa (form streaks, event chains, title tension)

### Completado en sesiones anteriores

| # | Feature | Prioridad | Estado |
|---|---------|-----------|--------|
| Fase 9 | Motor de Rivales + 132 equipos UEFA reales | Alta | ✅ |
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
| #11 | Tipos de sanciones | Alta | ✅ |

### Pendiente para próxima sesión

| # | Feature | Prioridad | Notas |
|---|---------|-----------|-------|

---

## Fase 9 — Motor de Rivales + Datos Reales

> **Objetivo:** Las federaciones rivales dejan de ser "cáscaras vacías". Cada una tiene su
> liga interna con equipos reales, simula partidos, produce campeones, y afecta prestige.
> El jugador puede elegir confederación (UEFA, CONMEBOL, etc.) al crear la partida.

### Arquitectura actual (problema)

```
GameState:
  federations: Federation[]     ← 1 player + 4 rivals
  divisions: Division[]         ← SOLO del jugador
  teams: Team[]                 ← rivals tienen divisionOrden: null, sin jugadores
  history: SeasonRecord[]       ← SOLO del jugador
```

**Resultado:** Rival federations existen como datos estáticos. No tienen ligas, no juegan,
no generan campeones. Su prestige apenas cambia (+1 represalia).

### Arquitectura propuesta

```
GameState:
  confederations: Confederation[]   ← NUEVO: UEFA, CONMEBOL, CONCACAF, etc.
  federations: Federation[]         ← EXPANDIDO: incluye confederationId
  divisions: Division[]             ← EXPANDIDO: incluye todas las ligas (player + rival)
  teams: Team[]                     ← EXPANDIDO: rivals ahora tienen divisionOrden
  history: SeasonRecord[]           ← EXPANDIDO: incluye rivales
  rivalRng: RngState                ← NUEVO: RNG independiente para simular rivales
```

---

### Fase 9.1 — Datos semilla (seed data)

**Archivo nuevo:** `packages/engine/src/seed-data.ts`

Contiene la estructura del mundo real hardcodeada (sin dependencia de APIs externas):

```typescript
interface ConfederationData {
  id: number;
  name: string;           // 'UEFA', 'CONMEBOL', etc.
  region: string;
  available: boolean;     // false = "Próximamente"
  leagues: LeagueData[];
}

interface LeagueData {
  name: string;           // 'Premier League', 'La Liga', etc.
  country: string;
  divisions: DivisionData[];
}

interface DivisionData {
  name: string;           // 'Primera División'
  orden: number;
  teams: TeamData[];
}

interface TeamData {
  name: string;
  strength: number;       // 32-95 (basado en grandeza real)
  arraigo: number;        // 50-100 (lealtad al club/federación)
  stadium: string;
}
```

**Contenido:** Solo UEFA disponible. CONMEBOL aparece como "Próximamente".

#### UEFA — 7 federaciones, 132 equipos

| País | Liga | Equipos | Elite (80+) | Fuertes (65-79) | Medios (50-64) | Bajos (35-49) |
|------|------|---------|-------------|-----------------|----------------|---------------|
| 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra | Premier League | 20 | 6 | 4 | 5 | 5 |
| 🇪🇸 España | La Liga | 20 | 3 | 5 | 4 | 8 |
| 🇮🇹 Italia | Serie A | 20 | 5 | 3 | 4 | 8 |
| 🇩🇪 Alemania | Bundesliga | 18 | 2 | 4 | 5 | 7 |
| 🇫🇷 Francia | Ligue 1 | 18 | 1 | 4 | 5 | 8 |
| 🇳🇱 Holanda | Eredivisie | 18 | 0 | 3 | 5 | 10 |
| 🇵🇹 Portugal | Primeira Liga | 18 | 3 | 1 | 3 | 11 |

**Ejemplo — Premier League (20 equipos):**
```
Man City (92, arraigo 95)  · Etihad Stadium
Liverpool (90, arraigo 95) · Anfield
Arsenal (88, arraigo 95)   · Emirates Stadium
Man Utd (83, arraigo 90)   · Old Trafford
Chelsea (82, arraigo 90)   · Stamford Bridge
Tottenham (78, arraigo 85) · Tottenham Hotspur Stadium
Newcastle (75, arraigo 80) · St James' Park
Aston Villa (70, arraigo 80) · Villa Park
West Ham (65, arraigo 75)  · London Stadium
Brighton (62, arraigo 65)  · AMEX Stadium
... (10 más)
```

**Ejemplo — La Liga (20 equipos):**
```
Real Madrid (95, arraigo 100) · Santiago Bernabéu
Barcelona (90, arraigo 95)    · Estadi Olímpic
Atlético (82, arraigo 85)     · Cívitas Metropolitano
Athletic Club (72, arraigo 90) · San Mamés
Villarreal (68, arraigo 75)   · Estadio de la Cerámica
Sevilla (68, arraigo 80)      · Sánchez-Pizjuán
Real Betis (65, arraigo 75)   · Benito Villamarín
Real Sociedad (65, arraigo 80) · Reale Arena
... (12 más)
```

**Ejemplo — Bundesliga (18 equipos):**
```
Bayern Munich (92, arraigo 95)    · Allianz Arena
Dortmund (82, arraigo 85)         · Signal Iduna Park
Leverkusen (78, arraigo 75)       · BayArena
Leipzig (75, arraigo 70)          · Red Bull Arena
Stuttgart (70, arraigo 80)        · MHPArena
Frankfurt (70, arraigo 75)        · Deutsche Bank Park
... (12 más)
```

**Rating de prestigio (strength) basado en:**
- Títulos de liga + Champions League + histórico
- Calidad actual de plantilla
- Poder financiero
- Real Madrid (95) es el máximo: 15 Champions, hegemonía histórica

**Rating de arraigo basado en:**
- Identidad local del club
- Historial de resistencia a transferencias
- Tamaño de la afición
- Real Madrid/Barcelona/Bayern: 95-100 (casi imposible de poach)
- Monaco: 65 (históricamente vende)
- Equipos recién ascendidos: 50-60

**Ejemplo UEFA:**
- Premier League (14 equipos): Man City, Arsenal, Liverpool, Chelsea...
- La Liga (14 equipos): Barcelona, Real Madrid, Atlético, Sevilla...
- Serie A (14 equipos): Inter, Milan, Juventus, Napoli...
- Bundesliga (14 equipos): Bayern, Dortmund, Leipzig...

**Ejemplo CONMEBOL:**
- Liga Argentina (12 equipos): Boca, River, Racing, San Lorenzo...
- Liga Brasileña (12 equipos): Flamengo, Palmeiras, Corinthians...

---

### Fase 9.2 — Tipos del motor

**Cambios en `types.ts`:**

| Tipo | Cambio |
|------|--------|
| `Confederation` | NUEVO: `{ id, name, region }` |
| `Federation` | Agregar `confederationId: number` |
| `Division` | Agregar `federationId: number` para saber a quién pertenece |
| `GameState` | Agregar `confederations[]`, `rivalRng` |
| `SeasonRecord` | Agregar `federationId?: number` para distinguir player vs rival |

---

### Fase 9.3 — Creación del mundo

**Cambios en `engine.ts createGame`:**

1. Recibe `confederations` en las opciones (o usa default)
2. Por cada confederación, por cada liga, por cada división:
   - Crea `Division` entries con `federationId`
   - Crea `Team` entries con `divisionOrden` (ya no null)
3. Las divisiones del jugador se marcan como "player league"
4. Se genera un `rivalRng` independiente

**Cambios en `world-generator.ts`:**

1. En vez de generar 4 federaciones genéricas, genera federaciones basadas en datos semilla
2. Cada rival federation tiene equipos reales con fuerza predefinida
3. El jugador elige confederación → se asigna a esa liga
4. Los equipos del jugador se generan dentro de la liga elegida

---

### Fase 9.4 — Simulación de ligas rivales

**Nuevo archivo:** `packages/engine/src/rival-sim.ts`

Función principal: `simulateRivalLeagues(s: GameState): void`

Flujo:
1. Para cada división que NO sea del jugador:
   - Generar fixtures round-robin (usando `rivalRng`)
   - Simular todos los partidos (usando `match.ts` con team.strength)
   - Calcular standings (usando `standings.ts`)
   - El campeón es el primero de la tabla
2. Actualizar `team.strength` basado en posición:
   - Campeón: +2-3 strength
   - Último: -2-3 strength
   - Promedio: drift suave ±1
3. Los resultados se descartan después de季节 (no se guardan fixtures individuales)
4. Solo se guarda el standings final y el campeón en `history`

**Integración en `closeSeason`:**
```
1. computeStandings (player divisions) — EXISTE
2. simulateRivalLeagues(s) — NUEVO
3. write seasonRecords for ALL divisions — MODIFICADO
4. updateRivalPrestige(s) — NUEVO: campeón rival +3, último -2
```

---

### Fase 9.5 — Persistencia en DB

**Cambios en `game.service.ts createGame`:**

1. Por cada rival federation → insertar `leagues` row
2. Por cada liga rival → insertar `divisions` rows
3. Por cada equipo rival → asignar `divisionId` (ya no null)

**Cambios en `game.service.ts closeSeason`:**

1. Insertar `seasonRecords` para divisiones rivales (campeón)
2. Insertar `seasonRecordPositions` para standings rivales
3. Actualizar `teams.strength` y `federations.prestige` en DB

**Migration:** No se necesita nueva tabla. Las tablas `leagues`, `divisions`,
`seasonRecords` ya soportan múltiples federaciones. Solo se insertan más rows.

---

### Fase 9.6 — Contratos y API

**Cambios en `contracts/index.ts`:**

| DTO | Cambio |
|-----|--------|
| `FederationOverview` | Agregar `standings: StandingRowDto[]` (posiciones de liga rival) |
| `FederationOverview` | Agregar `confederationName?: string` |
| `GameSummary` | Agregar `confederationName?: string` |

**Cambios en `game.controller.ts`:**

- `GET /games/:id/federations/:fedId` ya existe → modificar para incluir standings

---

### Fase 9.7 — Frontend

**FederationPage.tsx (rival):**
- Debajo de "Divisiones", agregar sección "Tabla de posiciones"
- Mostrar: posición, equipo, PJ, PG, PE, PP, GF, GC, DG, Puntos
- Highlight del campeón actual
- Badge "Histórico" si el equipo ha sido campeón

**FederationPage.tsx (player):**
- Sin cambios significativos (ya muestra todo)

**FederationsPage.tsx:**
- Mostrar confederación de cada federación (badge o agrupación)
- Highlight de rivales de la misma confederación

**TeamsPage.tsx:**
- Los equipos rivales ahora aparecen en sus divisiones reales
- El tab "Otras federaciones" muestra ligas reales

**GameLayout.tsx:**
- Sidebar muestra confederación del jugador

---

### Orden de implementación

| Paso | Archivo(s) | Descripción |
|------|-----------|-------------|
| 1 | `seed-data.ts` | Datos semilla: confederaciones, ligas, equipos reales |
| 2 | `types.ts` | Confederation, expandir Federation/Division/GameState |
| 3 | `engine.ts` | createGame: crear ligas rivales |
| 4 | `rival-sim.ts` | simulateRivalLeagues: simulación abstracta de temporada |
| 5 | `engine.ts` | closeSeason: integrar rival sim + escribir history |
| 6 | `world-generator.ts` | Usar datos semilla, elegir confederación |
| 7 | `game.service.ts` | Persistir ligas rivales, closeSeason con rivales |
| 8 | `contracts/index.ts` | FederationOverview con standings |
| 9 | `FederationPage.tsx` | Tabla de posiciones rival |
| 10 | `FederationsPage.tsx` | Agrupar por confederación |
| 11 | `TeamsPage.tsx` | Equipos rivales en divisiones reales |
| 12 | `GameLayout.tsx` | Sidebar con confederación |

---

### Constraints

- **RNG golden-stable:** `rivalRng` independiente. Jamás usar `state.rng` para rivales.
- **Performance:** ~2000 match simulations por season (~2ms, despreciable).
- **GameState size:** Pruning de fixtures rivales después de closeSeason (guardar solo standings).
- **Backward compatibility:** Existing saves con `divisionOrden: null` → migración en `loadState`.
- **No API calls:** Datos hardcodeados. Sin dependencia de red.

### Verificación

```bash
pnpm typecheck          # 6/6 packages pass
pnpm test               # engine tests pass + nuevos tests para rival-sim
```
| Fase 8 Batch 2 | Narrativa (form streaks, event chains, title tension) | Alta | Ver tabla arriba |
| — | Tests de ida y vuelta | Alta | Agregar test cases para `eliminatoria_ida_vuelta` |
| — | Tests de nuevos tipos de normas | Alta | Agregar test cases para `tope_extrangeros`, `minimo_cantera`, `tope_edad_media` |
| — | Snapshot golden test | Media | Actualizar con cambios de cups.ts + events

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
| **7. Consecuencias Eventos** | ✅ COMPLETADA | Consecuencias diferenciadas por tipo de evento |
| **8. Estrategia/Dificultad** | 🔄 EN PROGRESO | Batch 1 completo, Batch 2-3 pendientes |

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

## Fase 7: Consecuencias Reales en Eventos (Diseño)

### Problema actual

Los 8 tipos de evento tienen **las mismas consecuencias** excepto `manipulacion_resultados`:
- `actuar`: -1M€ + -3 arraigo (siempre igual)
- `ignorar`: -N prestige + +1 arraigo (varía solo por severidad)

El sabor del evento es solo texto cosmético. No hay diferencia mecánica entre un doping positivo y un escándalo de directiva.

### Solución: consecuencias diferenciadas por tipo

Cada tipo de evento obtiene una consecuencia mecánica única al **actuar** (investigar). El `ignorar` mantiene el patrón actual (prestige loss por severidad).

#### Nuevos campos en GameState (temporada)

```typescript
// Consecuencias temporales de eventos (se resetean al cerrar temporada)
eventStrengthPenalty: number;    // -N strength a todos los equipos del jugador
eventCapacityPenaltyPct: number; // -N% capacidad de estadios del jugador
eventImpulseLoss: number;        // -N impulsos consumidos
eventTreasuryInjection: number;  // +N€ inyectados por bailout
```

#### Consecuencias por tipo de evento

| Tipo | Severidad | `actuar` (investigar) | `ignorar` |
|------|-----------|----------------------|-----------|
| `arbitraje_dudoso` | media | -1M€, -3 arraigo, **-1 impulse** | -2 prestige, +1 arraigo |
| `incidente_aficion` | media | -1M€, -3 arraigo, **-10% capacidad estadio** 1 temporada | -2 prestige, +1 arraigo |
| `declaraciones_polemicas` | baja | -1M€, -3 arraigo, **-1 prestige** (multa) | -1 prestige, +1 arraigo |
| `doping_positivo` | alta | -1M€, -3 arraigo, **-10 strength equipo** 1 temporada | -4 prestige, +1 arraigo |
| `conflicto_jugadores` | media | -1M€, -3 arraigo, **-5 strength equipo** 1 temporada | -2 prestige, +1 arraigo |
| `crisis_economica_club` | alta | -1M€, -3 arraigo, **+2M€ bailout** al club | -4 prestige, +1 arraigo |
| `escandalo_directiva` | alta | -1M€, -3 arraigo, **-2 impulses** | -4 prestige, +1 arraigo |
| `manipulacion_resultados` | alta | -1M€, -3 arraigo, **descenso 1 división** (ya existe) | -4 prestige, +1 arraigo |

### Efectos en cascada

| Efecto | Cómo impacta | Dónde se aplica |
|--------|-------------|-----------------|
| `-10 strength` | Equipo más débil en partidos, pierde posiciones | `simulateMatch()` usa `team.strength` |
| `-10% capacidad` | Menos ingresos por matchday | `economy.ts:128` — `homeMatches * stadiumCapacity * 15 * 0.7` |
| `-1 impulse` | Menos "thumb on the scale" disponibles | `engine.ts` — `impulsesRemaining` |
| `-2 impulses` | Idem, más severo | Idem |
| `+2M€ bailout` | Club evita bancarrota temporal | `s.treasury += 2_000_000` |

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `types.ts` | 4 nuevos campos en `GameState` |
| `engine.ts` | `createGame()` inicializa campos; `closeSeason()` resetea a 0 |
| `events.ts` | `resolveEvent()` case-switch por tipo; aplica efectos al state |
| `economy.ts` | `matchdayRevenue()` descuenta `eventCapacityPenaltyPct` |
| `contracts/index.ts` | `EventDto` agrega `effectDescription: string` (para UI) |
| `game.service.ts` | `eventsResponse()` genera `effectDescription` legible |
| `EventsPage.tsx` | Muestra descripción del efecto en card del evento |

### Cambios en frontend (EventsPage)

Cada evento mostrará una **descripción del efecto** en lugar de solo "costará 1 M€":

```
┌─────────────────────────────────────────────┐
│ 🔴 Dopaje positivo                          │
│ Resultado positivo de doping en un jugador  │
│ de Atlético de Madrid: escándalo mediático. │
│                                             │
│ ⚠️  Si actúas: -1M€, -3 arraigo,           │
│    el equipo pierde -10 strength 1 temporada│
│ ✅ Si ignoras: -4 prestige, +1 arraigo      │
│                                             │
│ [Actuar]  [Ignorar]                         │
└─────────────────────────────────────────────┘
```

### Orden de implementación

1. `types.ts` — Agregar 4 campos a GameState
2. `engine.ts` — Inicializar en `createGame()`, resetear en `closeSeason()`
3. `events.ts` — Lógica de consecuencias por tipo
4. `economy.ts` — Aplicar capacity penalty en revenue
5. `contracts` — Agregar `effectDescription` a EventDto
6. `game.service.ts` — Generar descripción legible
7. `EventsPage.tsx` — Mostrar descripción + consequence badge
8. Tests — Actualizar events.test.ts

---

## Fase 8: Estrategia y Dificultad (Batch 1 — Completado)

Feature batch para hacer el juego más estratégico con consecuencias reales. Sin ruta "correcta" de jugar.

### Batch 1 — Quick wins (Alto impacto, bajo riesgo)

| # | Feature | Archivos | Estado |
|---|---------|----------|--------|
| 1 | Fix `crisis_economica_club` exploit (+3M€ pero -5 strength) | `events.ts`, `game.service.ts` | ✅ |
| 2 | Costo de normas activas (500K€/norma/año) | `economy.ts`, `types.ts` (LastEconomy), `contracts` | ✅ |
| 3 | Acción `cultivateArraigo` (2M€, +5-10 arraigo, máx 2 equipos/temporada) | `engine.ts`, `game.service.ts`, `game.controller.ts`, `api.ts`, `TeamDetailPage.tsx` | ✅ |
| 4 | Decay de arraigo (-2/temporada para equipos del jugador) | `engine.ts` closeSeason | ✅ |
| 5 | Cooldown de poaching (2 temporadas tras fallo) | `negotiation.ts`, `types.ts` (poachCooldowns) | ✅ |
| 6 | Base prestige decay -1 → -2 | `engine.ts` closeSeason | ✅ |
| 7 | Costo de creación de copa (2M€) | `cups.ts` | ✅ |
| 8 | Tipos de sanciones (#11) | `types.ts`, `norms.ts`, `contracts`, `NormsPage.tsx` | ✅ |

### Batch 2 — Narrativa (Pendiente)

| # | Feature | Prioridad | Notas |
|---|---------|-----------|-------|
| 8 | Congestión por copas (-1 strength/partido, máx -3) | Alta | Cups |
| 9 | Cadenas de eventos (doping → declaraciones polémicas) | Alta | Events |
| 10 | Resultados positivos en resolución (+prestige chance) | Media | Events |
| 11 | Form streaks (+2/-1 strength) | Alta | Engine |
| 12 | Tensión de lucha por título (+1 strength si gap ≤3) | Media | Engine |
| 13 | Pánico por descenso (-2 strength en puestos de descenso) | Media | Engine |

### Batch 3 — Profundidad estratégica (Pendiente)

| # | Feature | Prioridad | Notas |
|---|---------|-----------|-------|
| 14 | Multiplicador de contratos por tier (+/-20%) | Alta | Economy |
| 15 | Veto de transferencia (1M€, bloquear salida) | Media | Transfers |
| 16 | Treasury por club (cambio arquitectónico grande) | Media | Transfers |

### Efectos en cascada

| Efecto | Cómo impacta | Dónde se aplica |
|--------|-------------|-----------------|
| `-10 strength` (doping) | Equipo más débil en partidos | `simulateMatch()` |
| `-10% capacidad` (incidente) | Menos ingresos matchday | `economy.ts:129` |
| `-1 impulse` (arbitraje) | Menos "thumb on the scale" | `engine.ts` impulsesRemaining |
| `+3M€ bailout` (crisis) pero `-5 strength` | Club sobrevive pero más débil | `events.ts` |
| `500K€/norma` | Costo real de gobernanza | `economy.ts` processEconomy |
| `2M€ cultivateArraigo` | Inversión en lealtad de equipos | `engine.ts` |
| `-2 arraigo/season` | Arraigo es inversión, no permanent | `engine.ts` closeSeason |
| `2M€ crear copa` | Decisión real de competir | `cups.ts` |

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
