# Plan Fase 11 — El Mundo Está Vivo

> Junio 2026. El simulador tiene buen volumen de mecánicas pero el juego se siente vacío:
> avanzar jornadas es instantáneo porque las ligas rivales solo se simulan en un único batch
> al cierre de temporada. Este plan lo cambia todo.

---

## Diagnóstico raíz

`simulateRivalLeagues()` en `rival-sim.ts` simula una temporada entera de todas las ligas rivales
de golpe en el `closeSeason`. Esto significa:

- Avanzar jornada 5 → nada pasa en el mundo rival.
- `rivalStandings` muestra la clasificación FINAL del año anterior, nunca la parcial del actual.
- No hay campeones, pichichi ni copas que el jugador pueda seguir durante la temporada.
- No hay jugadores rivales: los equipos rivales usan `strength` como proxy, no tienen individuos.
- Las transferencias inter-ligas son invisibles.

El resultado: la liga del jugador existe en una burbuja. El mundo parece congelado.

---

## Arquitectura del cambio

La solución central es **partir la simulación en tres momentos**:

| Momento | Función | Cuándo |
|---------|---------|--------|
| `startSeason` | `generateRivalFixtures(s)` — genera el calendario rival para toda la temporada | Al iniciar temporada |
| `advanceMatchday` | `stepRivalMatchdays(s, targetMD)` — simula jornadas rivales en paralelo | Cada avance de jornada |
| `closeSeason` | `finalizeRivalSeason(s)` — determina campeones, top scorer, copa | Al cerrar temporada |

El `rivalRng` sigue siendo el único RNG usado por todo código rival, nunca cruza con `state.rng`.
El golden test del engine necesitará `--update` (esperado; el snapshot cambia por el reordenamiento
del stream de `rivalRng`, pero la determinism guarantee se mantiene).

### Sincronización de jornadas

El jugador tiene `totalMatchdays` jornadas. Los rivales pueden tener distintos totales según cuántos
equipos tenga cada división. La función `stepRivalMatchdays` recibe el número de jornada rival
**destino** y avanza desde `s.rivalCurrentMatchday` hasta ese punto:

```
targetRivalMD = Math.ceil(playerMD * max(rivalDivTotalMatchdays) / playerTotalMatchdays)
```

Los fixtures de federaciones con menos jornadas simplemente se agotan antes — la función
no encuentra más partidos para esas jornadas altas y para sola para esa federación.
No se necesita rastrear matchday por federación; una sola clave `rivalCurrentMatchday: number`
en GameState es suficiente.

---

## Batch 11.1 — Simulación incremental (el cambio estructural)

**Objetivo:** Cuando avanzas jornada 7 en tu liga, también se juega la jornada 7 (proporcional)
en las ligas rivales. El Dashboard muestra resultados del mundo en tiempo real.

### Nuevos tipos (`packages/engine/src/types.ts`)

```typescript
export interface RivalFixture {
  homeId: number;
  awayId: number;
  matchday: number;
  federationId: number;
  divisionOrden: number;
}

export interface RivalMatchResult {
  matchday: number;
  federationId: number;
  homeId: number;
  homeName: string;
  awayId: number;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  isShock: boolean; // weaker team (lower strength) won — para titulares
}
```

**Nuevos campos en `GameState`:**
```typescript
rivalFixtures: RivalFixture[];              // generados en startSeason, vaciados al cerrar
rivalCurrentMatchday: number;               // hasta dónde han llegado los rivales
rivalLastMatchdayResults: RivalMatchResult[]; // solo la última jornada (para UI)
// rivalStandings ya existe — se actualiza incrementalmente
```

### Refactor `rival-sim.ts`

**Añadir:**
- `generateRivalFixtures(s: GameState): void` — genera fixtures round-robin para todas las divisiones
  rivales usando `s.rivalRng` y los guarda en `s.rivalFixtures`. Resetea `s.rivalCurrentMatchday = 0`.
  También resetea `s.rivalStandings` a objetos vacíos (0 PJ, 0 pts) para cada equipo de cada división.
  Llamada al inicio de `startSeason` (después de generar fixtures del jugador).

- `stepRivalMatchdays(s: GameState, targetMatchday: number): void` — procesa todas las jornadas
  rivales desde `s.rivalCurrentMatchday + 1` hasta `targetMatchday`. Por cada jornada:
  1. Filtra `s.rivalFixtures` por `matchday === md`.
  2. Simula cada partido con `simulateMatch(home, away, s.rivalRng)`.
  3. Actualiza `s.rivalStandings[key]` incrementalmente (misma estructura que hoy, solo suma resultados).
  4. Marca `isShock` si el equipo con menor `strength` ganó.
  5. Al finalizar el bucle, guarda los resultados de la última jornada procesada en
     `s.rivalLastMatchdayResults` (usado por el Dashboard).
  6. Actualiza `s.rivalCurrentMatchday = targetMatchday`.

**Modificar:**
- Eliminar `simulateRivalLeagues()` (o renombrarla a `_legacySimulateRivalLeagues` para
  referencia durante el refactor, luego borrar).

- `finalizeRivalSeason(s: GameState): void` — lee `s.rivalStandings` para determinar campeones
  (ya no simula nada, los standings son el acumulado de la temporada). Añade a `s.rivalChampions`.
  Luego llama `driftRivalStrengths`, `applyRivalInvestments`, `runRivalNegotiations`,
  `updateRivalPrestige` como antes. Vacía `s.rivalFixtures = []`.

### Cambios `engine.ts`

- `startSeason`: añadir `generateRivalFixtures(s)` tras la generación de fixtures del jugador.
  Añadir defaults de reset: `s.rivalCurrentMatchday = 0`.

- `advanceMatchday`: al final del body (antes del `return s`), añadir:
  ```typescript
  if (s.confederations.length > 0 && s.rivalFixtures.length > 0) {
    const maxRivalMD = Math.max(...s.rivalFixtures.map(f => f.matchday));
    const target = Math.min(maxRivalMD,
      Math.ceil(s.currentMatchday * maxRivalMD / s.totalMatchdays));
    if (target > s.rivalCurrentMatchday) stepRivalMatchdays(s, target);
  }
  ```

- `closeSeason`: reemplazar el bloque `simulateRivalLeagues` por `finalizeRivalSeason(s)`.

### Backward compat (`game.service.ts` → `loadState`)

```typescript
if (!state.rivalFixtures) state.rivalFixtures = [];
if (state.rivalCurrentMatchday === undefined) state.rivalCurrentMatchday = 0;
if (!state.rivalLastMatchdayResults) state.rivalLastMatchdayResults = [];
```

### Contratos (`packages/contracts/src/index.ts`)

```typescript
const RivalMatchResultDto = z.object({
  matchday: z.number(),
  federationId: z.number(),
  homeName: z.string(),
  awayName: z.string(),
  homeGoals: z.number(),
  awayGoals: z.number(),
  isShock: z.boolean(),
});

// Añadir a GameSummary:
rivalLastMatchday: z.array(RivalMatchResultDto).default([]),
```

### Backend (`game.service.ts` → `getSummary`)

Incluir `state.rivalLastMatchdayResults` en la respuesta del summary, agrupado por `federationId`
(junto con el nombre de la federación, que se puede resolver desde `state.federations`).

### Frontend (`DashboardPage.tsx`)

En la columna derecha del Dashboard (donde ya están mandates, headlines, brackets):
añadir una sección **"Jornada en Europa"** (o el nombre de la confederación del jugador) que
muestre los resultados de la última jornada rival agrupados por federación. Diseño compacto:
- Nombre de federación como header de grupo (color dimmed, estilo monospace)
- Cada resultado: `HomeTeam X–Y AwayTeam` en una sola línea
- Resultados shock (isShock) con un acento visual (ej. `!` o color naranja)
- Solo visible si `rivalLastMatchday.length > 0` y `phase === 'temporada'`

**Deliverable:** Avanzar jornada ahora mueve el mundo. El Dashboard muestra resultados
de ligas rivales en tiempo real.

---

## Batch 11.2 — Pichichi, campeones y récords de temporada rival

**Objetivo:** Al cerrar temporada, cada liga rival produce un campeón nombrado,
un top scorer con goles, y una tabla final navegable desde FederationsPage.

### Jugadores virtuales rivales

Los equipos rivales actualmente usan `strength` como proxy — no tienen `Player` objects.
Para tener pichichi necesitamos un modelo de jugador fino: nombres + goles acumulados.
No necesitamos salarios, posiciones, cantera ni ningún campo del `Player` de la liga del jugador.

**Nuevo tipo (`types.ts`):**
```typescript
export interface RivalPlayer {
  id: number;
  name: string;
  teamId: number;
  federationId: number;
  goals: number;         // temporada actual
  careerGoals: number;   // histórico (opcional para v1)
}
```

**Nuevo campo `GameState`:**
```typescript
rivalPlayers: RivalPlayer[];  // generado en startSeason, goles reseteados cada temporada
nextRivalPlayerId: number;
```

**`rival-sim.ts`:**

- `generateRivalPlayers(s)` — llamado en `startSeason`. Para cada equipo rival con `divisionOrden !== null`,
  genera 15 jugadores con nombres procedurales (nombre + apellido de listas cortas hardcoded, mezclados
  con `rivalRng`). Los `goals` se resetean a 0. Si el equipo ya tiene `rivalPlayers`, solo resetea los goles.
  
- Modificar `stepRivalMatchdays`: al simular cada partido rival, atribuir goles a jugadores.
  - Total goles del partido = `homeGoals + awayGoals`.
  - Para cada gol, pick random jugador del equipo anotador usando `rivalRng` (uniforme entre los 15).
  - Incrementar `rivalPlayer.goals`.
  
  Nota: esto añade ~N_goles llamadas extra a `rivalRng` por jornada. Asumible.

**Nuevo tipo de récord (`types.ts`):**
```typescript
export interface RivalSeasonRecord {
  year: number;
  federationId: number;
  federationName: string;
  championId: number;
  championName: string;
  runnerUpName: string;
  topScorer: { playerId: number; name: string; teamName: string; goals: number };
  relegated: string[];   // nombres de equipos descendidos
  promoted: string[];    // (si hay múltiples divisiones en futuro)
}
```

**Nuevo campo `GameState`:**
```typescript
rivalSeasonRecords: RivalSeasonRecord[]; // append-only, una por federación por año
```

**`finalizeRivalSeason`:** determinar `topScorer` iterando `s.rivalPlayers` por federación,
find max `goals`. Determinar `relegated` (último/s de standings). Push a `rivalSeasonRecords`.

### Contratos + Backend

- `RivalSeasonRecordDto` en `contracts/index.ts`
- `GET /games/:id/federations/:fedId` ya existe (`getFederationById`): extenderlo para incluir
  `seasonRecords: RivalSeasonRecord[]` cuando la federación es rival.
- `GET /games/:id/world-standings` (nuevo): devuelve `rivalStandings` del año en curso agrupado
  por federación — tablas en vivo de todas las ligas rivales.

### Frontend

**FederationsPage.tsx:** en el tab "Federaciones", al hacer click en una federación rival (ya navega
a `/games/$gameId/federations/$fedId`), la página `FederationPage.tsx` (que ya existe para la propia)
o una nueva `RivalFederationPage.tsx` muestra:
- Tabla de clasificación actual (`rivalStandings` para esa federación)
- Historial de campeones: tabla `year | campeón | top scorer | goles`

**FederationsPage.tsx → nuevo tab "Ligas en vivo":**  
Grid de tablas compactas (una por federación rival) mostrando top 5 de cada clasificación.
Botón "Ver completa" que navega al detalle.

---

## Batch 11.3 — Mercado inter-ligas

**Objetivo:** Las mejores estrellas de las ligas rivales pueden fichar por la liga del jugador
(y entre sí), proporcional al diferencial de prestigio. El jugador lo ve pero no lo controla.

### Mecánica

Al inicio de la pretemporada (`startSeason`, antes de generar calendario), se ejecuta
`processInterLeagueTransfers(s)`:

1. **Candidatos de exportación:** los top 3 scorers de las ligas rivales del año anterior
   que juegan en federaciones con `prestige < playerPrestige - 20`.
2. **Decisión de llegada:** para cada candidato, un dado `rivalRng` ponderado por el
   diferencial de prestigio determina si viene. Más diferencial → más probabilidad.
3. **Conversión:** si viene, se convierte de `RivalPlayer` a un `Player` completo en uno de los
   equipos del jugador (el de mayor strength), con `nationality: 'extranjero'`, `calidad` derivada
   de `goals * 3` (capped a 95).
4. **Coste:** se descuenta del tesoro federal como "bono de atracción" (fee de fichaje:
   `Math.round(player.calidad * 50_000)` — escalado con la calidad del jugador).
5. **Efecto en el rival:** el equipo origen pierde al jugador; su `strength` baja en 1-2 puntos.
6. **Registro:** el movimiento se registra en `s.transfers` (el log append-only existente)
   con un flag `isInternational: true`.

**Transferencias rival-a-rival:** extender `runRivalNegotiations` para también mover
`RivalPlayer`s entre federaciones (no solo equipos enteros). Diferencial de prestigio > 25
permite poaching de top scorers de federaciones más débiles.

### Contratos + Backend

- Extender `TransferEntry` en types.ts: añadir `isInternational?: boolean; fromFederationName?: string`.
- `TransfersResponse` ya existe — el backend puede filtrar por `isInternational`.
- Nuevo tab o sección en `TransfersPage.tsx`: "Movimientos internacionales" lista los fichajes
  inter-liga de la temporada.

### Límites del comisionado

El jugador NO elige qué jugador viene ni a qué equipo — mantiene la identidad de comisionado.
Lo que SÍ puede hacer:
- Ver quién llegó y de qué liga (TransfersPage)
- Influir en el flujo invirtiendo en el "fondo de atracción internacional" (un gasto opcional
  en EconomyPage, si se decide implementar en fase posterior)
- Blindar jugadores con `cultivateArraigo` aplicado a los recién llegados (para que no se vayan)

---

## Batch 11.4 — Copas internacionales rivales

**Objetivo:** Cada federación rival tiene su propia copa, cuyo ganador se registra en el historial.
El jugador puede ver brackets y campeones.

### Diseño

Simular copas rivals al cierre de temporada (no incrementalmente — las copas rivales son menos
prioritarias que las ligas en cuanto a "inmediatez"). Al final de `finalizeRivalSeason`:

1. Por cada federación rival con ≥ 4 equipos, tomar los top-4 de la liga (`rivalStandings`).
2. Simular una copa de eliminatoria simple (2 semifinales + final) con `simulateMatch` y `rivalRng`.
3. Guardar el ganador en `RivalSeasonRecord.cupWinner: { name: string; teamId: number }`.

Este mecanismo no requiere bracket state persistido — se resuelve de una vez al cierre.
El resultado aparece en la página de historial de cada federación rival.

### Si en el futuro se quiere copa inter-ligas (Champions)

Esto requeriría:
- Un nuevo `CupFormat`: `'inter_liga'` — copa entre top equipos de distintas federaciones.
- Gestionada por el jugador como comisionado: decide quiénes participan, formato, premios.
- Solo disponible cuando `playerPrestige >= 70` (tier 1-2).
- Equipos de federaciones rivales que quieran participar vía `runRivalNegotiations`.

Este feature no es parte de Fase 11 — requiere análisis propio. Anotar como Fase 12.

---

## Notas de implementación

### RNG y golden test

Mover `generateRivalFixtures` a `startSeason` y `stepRivalMatchdays` a `advanceMatchday` cambia
cuándo avanza `rivalRng`. El stream del jugador (`state.rng`) **no se ve afectado** — son RNGs
independientes. El golden test fallará por el reordenamiento de `rivalRng` y debe actualizarse:

```bash
pnpm --filter @football-gm/engine test -- test/golden.test.ts --update
```

### Orden de llamadas en `closeSeason`

```
finalizeRivalSeason(s)  // determina campeones, top scorer, copa desde standings ya completos
  └─ driftRivalStrengths(s, standings)
  └─ applyRivalInvestments(s)
  └─ runRivalNegotiations(s)   // mover equipos entre rivales + rival player poaching
  └─ updateRivalPrestige(s)
```

### Orden de llamadas en `startSeason`

```
generateRivalFixtures(s)   // genera calendario rival usando rivalRng
generateRivalPlayers(s)    // resetea goles; genera jugadores si no existen
processInterLeagueTransfers(s)  // estrellas rivales fichando por la liga del jugador
```

### Memoria estimada

| Estructura | Tamaño estimado |
|-----------|----------------|
| `rivalFixtures` | 7 feds × ~380 partidos = ~2660 objetos × 5 campos = ~13K valores |
| `rivalPlayers` | 7 feds × 20 equipos × 15 jugadores = ~2100 objetos × 5 campos = ~10K valores |
| `rivalLastMatchdayResults` | máx 7 feds × 10 partidos = 70 objetos |
| `rivalSeasonRecords` | 1 por fed por año = 7/año, acumula con los años |

Todo manejable en JSONB. No se necesita cambio de esquema de base de datos.

### Backward compat en `loadState`

```typescript
if (!state.rivalFixtures) state.rivalFixtures = [];
if (state.rivalCurrentMatchday === undefined) state.rivalCurrentMatchday = 0;
if (!state.rivalLastMatchdayResults) state.rivalLastMatchdayResults = [];
if (!state.rivalPlayers) state.rivalPlayers = [];
if (state.nextRivalPlayerId === undefined) state.nextRivalPlayerId = 1;
if (!state.rivalSeasonRecords) state.rivalSeasonRecords = [];
```

---

## Resumen de archivos por batch

| Batch | Engine | Backend | Frontend |
|-------|--------|---------|----------|
| 11.1 | `types.ts`, `rival-sim.ts`, `engine.ts` | `game.service.ts` (loadState + getSummary) | `DashboardPage.tsx` |
| 11.2 | `types.ts`, `rival-sim.ts` | `game.service.ts`, `game.controller.ts`, `contracts` | `FederationsPage.tsx`, `FederationPage.tsx` (o nueva `RivalFederationPage.tsx`) |
| 11.3 | `types.ts`, `rival-sim.ts`, `transfers.ts` | `game.service.ts` | `TransfersPage.tsx` |
| 11.4 | `rival-sim.ts` | `game.service.ts` | `FederationsPage.tsx` (historial) |

---

## Checklist de tests

- [ ] `pnpm --filter @football-gm/engine test -- test/golden.test.ts --update` — actualizar snapshot
- [ ] Test nuevo: `rival-incremental.test.ts` — verifica que avanzar N jornadas produce `rivalCurrentMatchday > 0` y `rivalLastMatchdayResults.length > 0`
- [ ] Test nuevo: `rival-season-record.test.ts` — verifica que `closeSeason` produce `rivalSeasonRecords` con campeón y top scorer para cada federación con ≥ 2 equipos
- [ ] Typecheck limpio tras cada batch: `pnpm typecheck`
