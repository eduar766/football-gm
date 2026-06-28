# Plan Fase 10 — Update consolidado

> Generado en Junio 2026 a partir de auditoría multi-agente (UX/UI, Mecánicas, Economía, Funcionalidades).

## Diagnóstico raíz

Dos problemas bloquean el potencial del juego:

1. **La negociación es un temporizador, no una mecánica** — §4.2 del diseño describe requisitos que el jugador debe cumplir activamente; la implementación solo cuenta temporadas y tira dados.
2. **La economía está rota a favor del jugador** — regresión Fase 9: `processEconomy` cuenta los ~132 equipos rivales en vez de los ~20 del jugador. Ingresos 10× los costes. Todos los frenos de snowball son triviales.

---

## Batch 1 — Arreglos críticos (bugs y balance) `URGENTE`

| # | Fix | Archivos | Estado |
|---|-----|---------|--------|
| 1.1 | **Fix bug filter Fase 9**: `processEconomy` filtra por `playerFederationId` (competing, divisions, matchday loop, merchandise) | `economy.ts` | ✅ Hecho |
| 1.2 | **Recalibrar ingresos**: matchday 70%→10% (comisión), merchandise 50K→15K/equipo, contratos base ÷3 | `economy.ts` | ✅ Hecho |
| 1.3 | **Fix `crisis_economica_club`**: actuaba dando +3M€ al tesoro; ahora cuesta 5M€ (rescate real) | `events.ts` | ✅ Hecho |
| 1.4 | **Límite de `callReview`**: máx 2/temporada + −1 prestige por uso (no solo coste económico) | `engine.ts` | ✅ Hecho |
| 1.5 | **Fix traspasos**: los fichajes entre clubes no drenan el tesoro federal | `transfers.ts` | ✅ Hecho |
| 1.6 | **Upside de normas**: `governanceBonus()` — normas cumplidas dan +1/+2 prestige al cierre | `norms.ts`, `engine.ts` | ✅ Hecho |

---

## Batch 2 — Indicadores de fase + Dashboard `UX CRÍTICO`

| # | Feature | Archivos |
|---|---------|---------|
| 2.1 | Chip de fase prominente en header de GameLayout (año + jornada + fase) | `GameLayout.tsx`, `contracts` |
| 2.2 | Dashboard en dos columnas: izquierda estado (tabla + fixtures), derecha bandeja de acciones (eventos, impulsos) | `DashboardPage.tsx` |
| 2.3 | Badges de urgencia en sidebar: badge numérico en "Eventos" y en "Normas" con violaciones pendientes | `GameLayout.tsx` |
| 2.4 | Proyección de tesorería: gráfico 3 temporadas con contratos actuales en EconomyPage | `EconomyPage.tsx` |
| 2.5 | Eliminar duplicación de eventos en Dashboard — solo count + link, detalles en EventsPage | `DashboardPage.tsx` |

---

## Batch 3 — Negociación con requisitos reales `CORE MECHANIC`

La pieza central del diseño §4.2 que no está implementada.

| # | Feature | Archivos |
|---|---------|---------|
| 3.1 | `NegotiationRequirement` type: `{ tipo: 'audiencia'\|'reparto'\|'prestigio'\|'estadio', objetivo, cumplido }` | `types.ts`, `contracts` |
| 3.2 | Reveal de requisito por temporada en `gathering_requirements` | `negotiation.ts`, `engine.ts` |
| 3.3 | Aceptación por requisitos cumplidos: reemplazar dado por `reqsCumplidos / reqsTotal >= 0.75` | `negotiation.ts` |
| 3.4 | UI de requisitos como checklist en NegotiationsPage | `NegotiationsPage.tsx` |
| 3.5 | `negotiationOfferValue`: % de reparto comprometido que sale de economía anualmente | `types.ts`, `negotiation.ts`, `economy.ts` |
| 3.6 | Cooldown de reintento: al rechazar, bloquear 1 temporada via `poachCooldowns` | `negotiation.ts` |

---

## Batch 4 — Meta-juego: Mandatos de la junta `REPLAY VALUE`

| # | Feature | Archivos |
|---|---------|---------|
| 4.1 | `BoardMandate` type: `{ id, objetivo, target, deadline, estado }` en GameState | `types.ts` |
| 4.2 | Generador de mandatos en `startSeason`: 1-2 mandatos con deadline | `engine.ts` |
| 4.3 | Check de mandatos en `closeSeason`: evalúa cumplimiento, aplica bonus/penalización | `engine.ts` |
| 4.4 | UI de mandatos en Dashboard: progreso + deadline | `DashboardPage.tsx`, `contracts` |
| 4.5 | Fail-state suave: 2 mandatos fallidos consecutivos → −1 impulso/temporada (aviso) | `engine.ts` |

---

## Batch 5 — Narrativa emergente `INMERSIÓN`

| # | Feature | Archivos |
|---|---------|---------|
| 5.1 | Motor de titulares: plantillas sobre `matchReports` + `history` (rachas, sorpresas, goleadas) | `packages/engine/src/headlines.ts` (nuevo), `contracts`, `DashboardPage.tsx` |
| 5.2 | Crónica de cierre de temporada: campeón, revelación, decepción, mejor jugador | `engine.ts`, `contracts`, `DashboardPage.tsx` |
| 5.3 | Rivalidades emergentes: detectar desde `trajectories` pares de equipos en posiciones contiguas N años | `standings.ts`, `TeamDetailPage.tsx` |
| 5.4 | Arcos de eventos: usar `chainedFromId` para encadenar consecuencias entre temporadas | `events.ts`, `types.ts` |

---

## Batch 6 — Rivales con agencia real `MUNDO VIVO`

| # | Feature | Archivos |
|---|---------|---------|
| 6.1 | `invest` rival que modifica `strength` real de sus equipos | `rival-sim.ts`, `engine.ts` |
| 6.2 | Represalia selectiva: solo la federación robada gana prestige, no todas | `engine.ts` |
| 6.3 | Rivales que negocian entre sí: `runRivalNegotiations()` en `closeSeason` | `rival-sim.ts`, `negotiation.ts` |
| 6.4 | Separar prestige de fuerza en rivales: identidad propia que decae lento | `rival-sim.ts`, `types.ts` |

---

## Batch 7 — Datos históricos e historial visual `PROFUNDIDAD`

| # | Feature | Archivos |
|---|---------|---------|
| 7.1 | Gráfico de trayectoria de equipos: posición por temporada desde `trajectories` | `HistoryPage.tsx` |
| 7.2 | Libro de récords: mayor goleada, racha más larga, goleador histórico | `game.service.ts`, endpoint nuevo, `HistoryPage.tsx` |
| 7.3 | Coeficiente histórico de federaciones: acumula `globalRankings` → clasificación mundial persistente | `engine.ts`, `db/schema.ts`, `FederationsPage.tsx` |
| 7.4 | Export/import de partida: GameState serializado como JSON descargable | `game.controller.ts`, `game.service.ts` |

---

## Notas de implementación

- Todo lo que toca el motor de simulación sigue el patrón `loadState → engine fn → saveState` en `game.service.ts`.
- Campos nuevos en `GameState` siempre requieren un default en `loadState()` para backward compat.
- Los dos RNGs (`state.rng` vs `state.rivalRng`) nunca se mezclan — cualquier código de simulación del jugador usa `state.rng`.
- Los tests del engine son el contrato de correctitud: `pnpm test` debe pasar en verde tras cada batch.
