# Plan Fase 12 — El Comisionado Global

> Junio 2026. El mundo rival simula correctamente (Fase 11). Falta hacer ese
> mundo NAVIGABLE y darle al comisionado herramientas para interactuar con él.
> El siguiente salto de calidad: ver las ligas rivales en vivo, organizar una
> copa inter-ligas, y tener informes que conviertan los datos en inteligencia.

---

## Diagnóstico

Con Fase 11 el motor simula el mundo. Pero la UI solo expone:
- Dashboard: resultados de la última jornada rival (panel pequeño)
- FederationPage: historial de UNA federación rival (hay que navegar a cada una)
- HistoryPage: campeones de otras federaciones (solo tras cerrar temporada)

No hay vista global de clasificaciones en vivo, no hay copa que cruce federaciones,
y no hay informes que sinteticen la inteligencia mundial.

---

## Batch 12.1 — Ligas Mundiales en vivo

**Objetivo:** Una página central "Mundo" donde el comisionado puede ver, en tiempo
real, las clasificaciones de TODAS las ligas rivales mientras avanza jornadas.

### Nuevo endpoint

`GET /games/:id/world-standings`

Devuelve `rivalStandings` agrupado por federación, enriquecido con metadatos:

```typescript
// Contratos:
WorldFederationStanding {
  federationId: number
  federationName: string
  confederationName?: string
  prestige: number
  tier: 1|2|3|4|5
  matchdayProgress: number       // rivalCurrentMatchday
  divisions: {
    orden: number
    name: string
    standings: RivalStandingRow[]  // mismo shape que FederationPage
  }[]
}

WorldStandingsResponse {
  federations: WorldFederationStanding[]   // ordenadas prestige DESC
}
```

### Nueva página `WorldPage.tsx`

Ruta: `/games/$gameId/world`

Layout:
- Header con título "Ligas del Mundo" + chip de jornada rival actual
- Grid de cards, una por federación rival, ordenadas por prestige
- Cada card muestra:
  - Nombre de federación + tier badge + prestige
  - Nombre de confederación (dimmed)
  - Tabla compacta de la división principal (orden 1): posición, equipo, PJ, Pts
  - Solo las top 5 filas (resto colapsado)
  - Link "→ Ver federación" que navega a FederationPage
- Filtro por confederación (tabs o select)
- Empty state si `rivalCurrentMatchday === 0` ("La temporada rival aún no ha comenzado")

### Sidebar

Añadir "Mundo" al sidebar de `GameLayout.tsx` bajo la sección RESUMEN,
con ícono `IconGlobe` (o `IconWorld`).

### Archivos

| Capa | Cambios |
|------|---------|
| Backend controller | `GET /games/:id/world-standings` |
| Backend service | `getWorldStandings(gameId)` |
| Contracts | `WorldFederationStanding`, `WorldStandingsResponse` |
| Frontend api.ts | `api.worldStandings(gameId)` |
| Frontend WorldPage.tsx | nueva página |
| Frontend GameLayout.tsx | enlace sidebar |
| Frontend routes (router) | registrar ruta |

---

## Batch 12.2 — Copa Inter-Ligas

**Objetivo:** El comisionado puede organizar una copa donde participan los mejores
equipos de federaciones rivales. La copa es el logro máximo del comisionado global.

### Diseño

Disponible cuando `playerPrestige >= 50`. Se crea en pretemporada como cualquier copa,
pero de tipo `'copa'` con un nuevo selector "Invitar equipos rivales".

**Mecánica del motor:**

1. En pretemporada, el comisionado puede crear una copa "inter-ligas" seleccionando:
   - Cuántas federaciones rivales invitar (hasta 7)
   - El campeón de cada federación rival participante se convierte en equipo invitado
   - Más los top 1-2 de la propia liga del jugador
2. Los equipos invitados son entidades "virtuales" para la copa: tienen el strength del
   equipo campeón rival pero no se mueven de su federación.
3. La copa se simula igual que cualquier copa existente (`cupsRng`).
4. Al finalizar, el campeón recibe prestige bonus. Si es un equipo del jugador: +3 prestige.
   Si es un equipo rival: +1 prestige al jugador (por haber organizado).

**Nota RNG:** Los equipos rivales en la copa usan `cupsRng`, no `rivalRng`. La copa
es una competición del jugador, no del motor rival.

**Simplificación v1:** No añadir equipos rivales reales a `s.teams` — crear entidades
temporales `InterLeagueTeam` solo para la duración de la copa, con `id < 0` (ids negativos
reservados para rivales en copa inter-ligas). Esto evita contaminar `s.teams`.

---

## Batch 12.3 — Informes del Comisionado

**Objetivo:** Una página de informes que convierte todos los datos acumulados
(rival records, transfers, standings, history) en inteligencia accionable.

### Secciones

1. **Ranking Global de Goleadores** — top 10 pichichi de todas las ligas rivales del
   último año cerrado. Fuente: `rivalSeasonRecords[*].topScorer`.

2. **Resumen de Temporada Mundial** — cuando la temporada está en curso, muestra:
   - Líder actual de cada liga rival (top de la clasificación en vivo)
   - Campeón de la copa rival del año anterior

3. **Movimientos Internacionales** — historial de transfers inter-liga (ya implementado
   en TransfersPage). Aquí se muestra un resumen más visual: de qué liga, cuántos
   jugadores llegaron, coste total.

4. **Índice de Poder** — ranking de todas las federaciones (incluyendo la del jugador)
   por prestige + comparación año a año (subió/bajó). Fuente: `federationCoefficients`.

### Archivos

| Capa | Cambios |
|------|---------|
| Backend service | `getWorldReport(gameId)` — agrega datos de engine state |
| Contracts | `WorldReportResponse` |
| Frontend | `WorldReportPage.tsx` o sección en `WorldPage.tsx` |

---

## Checklist de tests

- [ ] Typecheck limpio tras cada batch: `pnpm typecheck`
- [ ] `pnpm test` — 99/99 (o más si se añaden tests)
- [ ] Test nuevo (12.1): `world-standings.test.ts` — verifica que el endpoint
      agrupa correctamente cuando hay rivalStandings en varios formatos de clave
