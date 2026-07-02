# Plan de mejoras / correcciones (post-Fase 14)

> Documento vivo. Se actualiza tras cada mejora. Nace de la revisión de pantallas
> del usuario (jul 2026): tras Fase 14 mergeada + fixes de bugs, quedan áreas de
> riesgo detectadas en una auditoría. Orden por impacto real: P1 (bug funcional)
> → P2 (usabilidad) → P3-P5 (pulido visual).

**Reglas de trabajo:** cada mejora verifica `typecheck` + `lint` (+ engine tests si
toca engine); el usuario commitea; **sin atribución de co-autoría** en commits/PRs.
Aleatoriedad nueva usa streams dedicados, nunca `state.rng`. Guard de contaminación
de división (`federationId === playerFederationId`) en toda query de datos del jugador.

---

## Estado

| Prio | Área | Estado |
|------|------|--------|
| P1 | Ficha de equipo rival vacía/engañosa | ✅ HECHO |
| P2 | Bracket de copas inusable (huecos / copas no iniciadas) | ✅ HECHO |
| P3 | Charts no siguen el tema HUD (colores hardcodeados) | ✅ HECHO |
| P4 | Páginas con mucha data solo con shell (Economía, Historial) | ✅ HECHO (pase enfocado) |
| P5 | Consistencia de estados vacíos (adoptar `EmptyState`) | 🟡 Parcial (páginas clave hechas) |

---

## P1 — Ficha de equipo rival vacía/engañosa

**Síntoma:** abrir un equipo rival (p.ej. PSG desde Historial→Otras Federaciones o
clasificaciones) muestra `Plantilla 0`, `Afición 0`, `Estadio –(0)`, trayectoria vacía.

**Causa raíz** (`apps/backend/src/game/game.service.ts` → `getTeam`):
- `squad` sale de `s.players WHERE teamId`; los rivales usan `rivalPlayers` virtuales
  (no persistidos) → Plantilla 0.
- `aficion`/`estadioAforo` a 0/null para rivales (world-generator solo rellena al jugador).
- `finance` ya es `null` para rivales (bien), pero el frontend no lo sabe.
- `TeamDetail` no tiene flag para distinguir → el frontend pinta el layout del jugador vacío.

**Fix:**
1. Contract `TeamDetail`: `isPlayerTeam: boolean` + objeto `rival` (posición actual en su
   liga desde `rivalStandings`, títulos desde `rivalChampions`/`rivalSeasonRecords`,
   goleadores desde `rivalPlayers`).
2. Backend `getTeam`: detectar rival y poblar `rival`.
3. Frontend `TeamDetailPage`: si `!isPlayerTeam`, layout adaptado (ocultar plantilla/finanzas/
   cultivar-arraigo; mostrar fuerza, prestigio de la federación, posición y palmarés).

**Verificación:** typecheck + lint.

---

## P2 — Bracket de copas inusable ✅

**Causa raíz REAL** (`components/BracketView.tsx`): la escala de `getCenter` estaba
**invertida** (`maxSlots / 2^roundIdx`) → los partidos de la 1ª ronda quedaban separados
`maxSlots·80px` entre sí (640px en un cuadro de 16) → huecos enormes con partidos "flotando".
No era espacio reservado sino posicionamiento incorrecto.
**Fix aplicado:** `scale = 2^roundIdx` (ronda 0 adyacente; rondas posteriores duplican el
espaciado). Conectores SVG verificados (midpoint de feeders = partido siguiente). Copas no
iniciadas muestran los emparejamientos de 1ª ronda compactos. typecheck+lint ✅.
**Follow-up opcional:** en `eliminatoria_ida_vuelta` se pintan ida y vuelta como 2 cards
separadas; se podría agregar en una sola card con marcador global (no era el bug reportado).

## P3 — Charts no siguen el tema HUD ✅

**Fix aplicado:** ambos charts (`EconomyChart`, `PalmaresChart`): tooltip `#1A2332` →
`var(--surface-2)` + `var(--border-2)` + `var(--panel-shadow)`; grid `rgba(255,255,255,0.05)`
→ `rgba(148,176,205,0.08)` (tono de los bordes HUD); ejes `rgba(255,255,255,0.4)` →
`rgba(148,176,205,0.45)`. EconomyChart: barras alineadas a la paleta HUD (Premios naranja→**oro**,
Talento azul→**violeta**, verde→esmeralda accent). typecheck+lint ✅.

## P4 — Páginas con mucha data solo con shell ✅ (pase enfocado)

Hallazgo: el cascade del tema (rediseño HUD) ya dejó estas páginas coherentes (hero de
Economía, tablas, badges heredan tokens). El delta real era la consistencia de estados
vacíos, que se veían "sin terminar".
**Fix aplicado:** `EmptyState` en EconomyPage (contratos vacíos, sin equipos en competición)
e HistoryPage (campeones de otras federaciones, cronología vacía). typecheck+lint ✅.
**Follow-up opcional (para un design-agent si se quiere ir más lejos):** StatTile KPI strips
+ readouts mono en las tablas internas de Economía/Historial (más profundidad visual, no crítico).

## P5 — Consistencia de estados vacíos 🟡 parcial

Adoptado `EmptyState` en las páginas de data clave (Economía, Historial) como parte de P4.
Quedan estados vacíos ad-hoc en otras páginas (Copas, Normas, etc.) — sweep menor pendiente.

---

## Registro de cambios

- **P1 HECHO** (typecheck+lint ✅). Contract `TeamDetail`: `isPlayerTeam` + objeto `rival`
  (divisionName, position, played, points, titles[], topScorers[]). Backend `getTeam`:
  detecta rival y puebla `rival` desde `rivalStandings` (posición actual), `rivalChampions`
  (títulos) y `rivalPlayers` (goleadores). Frontend `TeamDetailPage`: nuevo `RivalPanels`
  (banner "no gestionable", clasificación actual, palmarés, goleadores); stat list adaptada
  (Fuerza/Prestigio/Posición/Títulos, sin Afición/Estadio vacíos); botón "cultivar arraigo"
  oculto para rivales. Fallbacks correctos cuando el sim rival aún no ha corrido.
  Archivos: `packages/contracts/src/index.ts`, `apps/backend/src/game/game.service.ts`,
  `apps/frontend/src/routes/TeamDetailPage.tsx`.
  Nota: en game 80 mostrará "temporada rival aún no ha comenzado" hasta jugar la temporada 2
  (el sim rival se reactiva con la migración v12); desde ahí se puebla con datos reales.
