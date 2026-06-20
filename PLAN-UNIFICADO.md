# Football GM — Plan Unificado de Implementación

*UI Design + Game Mechanics — Junio 2026*

---

## Progreso

| Fase | Estado | Notas |
|------|--------|-------|
| **1. Quick Wins** | ✅ COMPLETADA | UI Foundation + Match Narrative + Mid-Season Agency |
| **2. Layout/Core** | ✅ COMPLETADA | Sidebar nav + Transfer fees + Cup penalties + Events + Norms |
| 3. High-Impact | ⬜ Pendiente | |
| 4. Remaining | ⬜ Pendiente | |
| 5. Polish | ⬜ Pendiente | |

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

---

## Resumen de Esfuerzo

| Fase | UI | Mecánicas | Total |
|------|-----|-----------|-------|
| 1. Quick Wins | 3h | 4h | **7h** |
| 2. Layout/Core | 6h | 8h | **14h** |
| 3. High-Impact | 10h | 12h | **22h** |
| 4. Remaining | 8h | 6h | **14h** |
| 5. Polish | 6h | 4h | **10h** |
| **TOTAL** | **33h** | **34h** | **~67h** |

---

## Archivos Afectados

### UI (apps/frontend/)
- **Crear:** `styles/global.css`, `design-tokens.ts`
- **Reescribir:** `theme.ts`
- **Modificar mayor:** `GameLayout.tsx`, `DashboardPage.tsx`, `TeamDetailPage.tsx`, `EconomyPage.tsx`, `GamesPage.tsx`, `App.tsx`, `index.html`, `main.tsx`
- **Modificar menor:** Todos los demás pages (12 archivos)

### Mecánicas (packages/engine/src/)
- **Modificar mayor:** `types.ts` (~230 líneas nuevas), `engine.ts` (~350 líneas nuevas), `transfers.ts` (~100 líneas nuevas), `events.ts` (~120 líneas nuevas)
- **Modificar menor:** `match.ts`, `awards.ts`, `cups.ts`, `norms.ts`, `economy.ts`, `negotiation.ts`
- **Sin cambios:** `rng.ts`, `fixtures.ts`, `structure.ts`, `salaries.ts`

---

## Orden de Ejecución Recomendado

```
Semana 1:  1A (UI Foundation) + 1B (Mecánicas Quick Wins)      ← paralelo
Semana 2:  2A (UI Layout) + 2B (Core Depth)                     ← paralelo
Semana 3:  3A (UI High-Impact)                                   ← solo UI
Semana 4:  3B (World Building)                                   ← solo mecánicas
Semana 5:  4A (UI Remaining) + 4B (UI Integration)              ← paralelo
Semana 6:  4B (UI Integration - si no terminó)
Semana 7:  5A (UI Polish)
Semana 8:  5B (Mecánicas Polish) + testing final
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
- [ ] Tipografía editorial: Plus Jakarta Sans headlines, DM Sans body, Geist Mono data
- [ ] Paleta coherente: emerald primary, gold prestige, purple commissioner, dark surfaces
- [ ] Sidebar nav funcional en desktop, bottom tabs en mobile
- [ ] Animaciones: page fadeInUp, card hover-lift, table row hover, badge pulse
- [ ] Todas las 17 pantallas con la nueva identidad visual
- [ ] Mobile responsive en todas las pantallas

### Mecánicas
- [ ] Match reports con goleadores, minutos, tarjetas
- [ ] 3 nuevas acciones mid-season (call review, emergency meeting, postpone)
- [ ] Transfer fees y wage budgets funcionando
- [ ] Penalty shootouts en copas knockout
- [ ] 8 tipos de eventos con severity y chaining
- [ ] Norm escalation (3/5/8 puntos)
- [ ] Rival AI: poaching defensivo, inversión, retaliación
- [ ] Player career arcs: crecimiento, pico, declive, retiro
- [ ] Global ranking cross-federación
- [ ] Todos los tests pasando, golden snapshot actualizado
