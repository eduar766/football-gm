# Plan Fase 13 — Mundos que Respiran

> Junio 2026. Fase 12 completó la visibilidad del mundo rival (WorldPage,
> inter-league cup, commissioner reports). Acabamos de añadir segundas divisiones
> reales con 140 equipos de la UEFA. El siguiente salto: hacer que esas divisiones
> VIVAN — que los equipos suban y bajen, que el mundo genere narrativa propia,
> y cerrar los stubs que llevan meses sin implementar.

---

## Diagnóstico

### Lo que está roto o vacío

| Gap | Archivo | Severidad |
|-----|---------|-----------|
| Rival promotion/relegation: `relegated[]` se guarda pero nadie cambia `divisionOrden` | `rival-sim.ts:414` | Crítico |
| `transferIncome = 0` hardcoded en federación | `economy.ts:172` | Importante |
| Titulares solo cubren la federación del jugador | `headlines.ts:49` | Importante |
| `vetoTransfer` es un comentario vacío desde Fase 8 | `engine.ts:1133` | Importante |
| `team.wageCap` inicializado a `0`, nunca escrito ni leído | `types.ts:90` | Menor |

### Lo que SÍ funciona y no hay que tocar

- `rival-sim.ts` simula fixtures completos para **todas** las divisiones (orden 1 y 2)
- Las standings de segunda división ya se almacenan en `rivalStandings["fedId:2"]`
- `WorldPage` ya muestra divisiones ordenadas por `orden`
- `MarketPage` y `FederationPage` ya agrupan equipos por división con la UI nueva
- `createInterLeagueCup` está implementado end-to-end

---

## Batch 13.1 — Ascenso y Descenso en Ligas Rivales

**Objetivo:** Los últimos de la primera división rival bajan a segunda; los primeros
de segunda suben. Las segundas divisiones dejan de ser decorativas.

### Motor (`rival-sim.ts` → `finalizeRivalSeason`)

Actualmente `finalizeRivalSeason` calcula `relegationCount` y guarda nombres, pero
nunca escribe `divisionOrden`. Añadir al final de cada iteración de división:

```
Por cada federación que tenga div.orden === 1 Y también div.orden === 2:
  1. Tomar rows de div1 ordenadas por posición (ya disponibles)
  2. Tomar rows de div2 ordenadas por posición (rivalStandings["fedId:2"])
  3. Swap de los últimos relegationCount de div1 con los primeros relegationCount de div2:
       t.divisionOrden = 2  (para los relegados de div1)
       t.divisionOrden = 1  (para los ascendidos de div2)
  4. Aplicar ajuste de strength:
       Ascendidos: +3 strength (adaptación a mayor nivel)
       Relegados:  −2 strength (pérdida de confianza/inversión)
       Ambos clampados al rango [20, 95]
```

**Guardia esencial:** solo hacer swap si existen AMBAS divisiones para esa federación.
Las federaciones con una sola división (si las hubiera) no se tocan.

**`RivalSeasonRecord`** — añadir `promotedTeamNames: string[]` paralelo a `relegated`
para poder mostrar "equipos que ascienden" en el historial.

### Migración

No necesaria: la migración v4 ya renumeró las divisiones correctamente. El swap
empieza a funcionar desde el primer `closeSeason` post-actualización.

### Tests

Nuevo test en `rival-sim.test.ts` (crear si no existe):
```typescript
it('bottom teams of div1 swap with top teams of div2 after closeSeason')
// Setup: game with 1 rival fed that has div1 (6 teams) and div2 (6 teams)
// Advance full season
// Assert: bottom 2 of div1 now have divisionOrden === 2
// Assert: top 2 of div2 now have divisionOrden === 1
```

---

## Batch 13.2 — Titulares del Mundo

**Objetivo:** El Dashboard muestra titulares de lo que pasa en el mundo rival,
no solo en la propia liga. Hace que el mundo se sienta vivo entre jornadas.

### Motor (`headlines.ts`)

La función `generateHeadlines` actualmente filtra por `federationId === playerFederationId`.
Añadir una segunda pasada que genera titulares de rivales usando `rivalLastMatchdayResults`.

**Tipos de titular rival** (máximo 3 por jornada, para no saturar):

```
1. Sorpresa: "[Equipo débil] derrota a [Equipo fuerte]" 
   — cuando el diferencial de fuerza entre winner y loser es > 20
   
2. Goleada: "[Equipo] golea [N]-[M] a [Rival]"
   — cuando la diferencia de goles >= 4

3. Líder: "[Equipo] lidera la [Liga]" (solo al principio de temporada, jornadas 1-3)
   — el equipo en posición 1 de la clasificación rival
```

**Tipo `Headline`** — añadir campo opcional `rivalFederationId?: number` y
`isRival?: boolean` para que el frontend pueda diferenciarlos visualmente.

### Backend

`getDashboard` ya devuelve `headlines`. Asegurarse de que los nuevos titulares
de rival se incluyen en la misma respuesta (no endpoint nuevo).

### Frontend (`DashboardPage.tsx`)

En el feed de titulares, mostrar los titulares `isRival === true` con un badge
de globo (`IconGlobe`) y color diferente (azul/índigo en lugar de ámbar).
Agrupar: primero titulares de la propia liga, luego los del mundo.

---

## Batch 13.3 — Veto de Transferencia Saliente

**Objetivo:** El comisionado puede proteger a un jugador de calidad de ser
traspasado fuera de la federación en la próxima ventana de transfers.

El stub lleva en `engine.ts:1133` desde Fase 8. Es el momento de implementarlo.

### Diseño

- Disponible en **pretemporada** únicamente
- Máximo **2 vetos activos** simultáneamente (se consumen al cerrar temporada)
- Sin coste de tesorería — es una prerrogativa del comisionado (cuesta 0)
- El jugador vetado no puede ser seleccionado por `processOutgoingInterLeagueTransfers`

### Motor (`engine.ts`)

**Nuevo campo en `GameState`:**
```typescript
transferVetoes: number[];   // array de playerIds protegidos
```

**Nueva función:**
```typescript
export function vetoTransfer(prev: GameState, playerId: number): GameState
```

Validaciones:
- `prev.phase !== 'pretemporada'` → return prev
- El player debe estar en un equipo de la federación del jugador
- `prev.transferVetoes.length >= 2` → return prev (límite)
- No puede vetar el mismo player dos veces

**Nueva función para cancelar:**
```typescript
export function cancelTransferVeto(prev: GameState, playerId: number): GameState
```

**`processOutgoingInterLeagueTransfers`** — antes de seleccionar `target`, filtrar:
```typescript
const candidates = s.players.filter(
  p => playerTeamIds.has(p.teamId) &&
       p.calidad >= 55 &&
       p.injuredMatchesLeft <= 2 &&
       !s.transferVetoes.includes(p.id)   // ← nuevo filtro
);
```

**Al cerrar temporada** (`closeSeason`): vaciar `s.transferVetoes = []`.

### Contratos

```typescript
export const VetoTransferRequest = z.object({ playerId: z.number().int() });
export const CancelVetoRequest = z.object({ playerId: z.number().int() });
```

### Backend

Nuevo endpoint en `season.controller.ts` (es acción de pretemporada):
```
POST /games/:id/veto-transfer      body: VetoTransferRequest
DELETE /games/:id/veto-transfer/:playerId
```

### Frontend (`TransfersPage.tsx`)

Durante pretemporada, en la lista de jugadores propios con calidad >= 55:
- Botón "Vetar traspaso" (con límite visible: "2/2 vetos usados")
- Jugador vetado muestra badge rojo "Protegido"
- Botón "Quitar protección" para cancelar

---

## Batch 13.4 — Tasa de Solidaridad (Ingresos por Traspaso)

**Objetivo:** Cerrar el bug de `transferIncome = 0`. Cuando un jugador de
calidad abandona la federación del jugador rumbo a una rival, la federación
recibe una tasa de solidaridad del 5% del valor del traspaso.

### Motor (`rival-sim.ts` → `processOutgoingInterLeagueTransfers`)

Actualmente el equipo vendedor recibe `fee = calidad × 60.000€` via `sellingTeam.treasury`.
Añadir: la **federación** recibe un 5% adicional como tasa de solidaridad.

```typescript
const solidarityFee = Math.round(fee * 0.05);
s.treasury += solidarityFee;
// (el fee completo ya va al equipo; la solidaridad es adicional, no resta del fee)
```

Guardar en un nuevo campo `outgoingTransferRevenue: number` que se acumula durante
`startSeason` → `closeSeason`:

```typescript
s.outgoingTransferRevenue = (s.outgoingTransferRevenue ?? 0) + solidarityFee;
```

### Motor (`economy.ts` → `processEconomy`)

Sustituir `const transferIncome = 0; // sell-on clause is future work` por:

```typescript
const transferIncome = s.outgoingTransferRevenue ?? 0;
s.outgoingTransferRevenue = 0; // reset para la próxima temporada
```

### Migración

Añadir en `migrations.ts` v5 (bump `CURRENT_SCHEMA_VERSION` a 5):

```typescript
if (!gs.outgoingTransferRevenue) gs.outgoingTransferRevenue = 0;
if (!gs.transferVetoes) gs.transferVetoes = [];
```

(Ambos campos de los batches 13.3 y 13.4 se migran en la misma versión.)

---

## Batch 13.5 — wageCap: Eliminar el Campo Muerto

**Objetivo:** Resolver la deuda técnica de `team.wageCap` que existe en `types.ts`
pero nunca se usa. Dos opciones:

**Opción A (recomendada): Eliminarlo limpiamente.**
El tope salarial ya está implementado como `NormType: 'tope_salarial'` en `norms.ts`,
que compara `salarioTotal` del equipo contra el objetivo de la norma. `wageCap` es
un remanente de un diseño anterior que no llegó a implementarse.

1. Eliminar `wageCap` de `Team` en `types.ts`
2. Eliminar inicializaciones en `engine.ts` (hay 4: líneas ~125, ~171, ~208, ~553)
3. Migración v5: `delete (team as any).wageCap` en la pasada de limpieza

**Opción B: Implementarlo como límite por equipo.**
Si se quiere que cada equipo tenga su propio tope salarial independiente de la norma,
definir su semántica correctamente y conectarlo a `norms.ts`. Esto amplía el scope
de forma significativa — dejar para una fase posterior.

→ Se va con **Opción A** en esta fase para mantener el código limpio.

---

## Tabla resumen de cambios por capa

| Batch | Engine | Backend | Frontend | Contratos | Migración |
|-------|--------|---------|----------|-----------|-----------|
| 13.1 Ascenso/descenso | `rival-sim.ts` | — | — | `RivalSeasonRecord` | — |
| 13.2 Titulares mundo | `headlines.ts` | `getDashboard` | `DashboardPage` | `Headline` type | — |
| 13.3 Veto transfer | `engine.ts`, `rival-sim.ts` | `season.controller`, `game.service` | `TransfersPage` | `VetoTransferRequest` | v5 |
| 13.4 Solidaridad | `rival-sim.ts`, `economy.ts` | — | — | — | v5 |
| 13.5 wageCap | `types.ts`, `engine.ts` | — | — | — | v5 |

---

## Invariantes que no deben romperse

- **Determinismo RNG:** la lógica de swap en `finalizeRivalSeason` usa solo datos
  ya calculados (standings ya fijadas). No consume `rivalRng` adicional en el swap.
- **`state.rng` intacto:** los titulares rivales leen `rivalLastMatchdayResults`
  (datos ya producidos), no generan partidos nuevos.
- **Golden master:** los batches 13.3–13.5 no cambian ninguna salida observable
  de la simulación (añaden campos opcionales o leen datos ya existentes). Los
  batches 13.1 y 13.2 SÍ cambian outputs: tras implementar 13.1, hay que ejecutar
  `pnpm --filter @football-gm/engine test -- test/golden.test.ts --update` para
  aceptar el nuevo snapshot.

---

## Checklist de tests

- [ ] `pnpm typecheck` limpio tras cada batch
- [ ] `pnpm test` — todos pasan tras cada batch
- [ ] **Nuevo** `rival-sim.test.ts` — test de ascenso/descenso (Batch 13.1)
- [ ] **Nuevo** `headlines.test.ts` — verifica que se generan titulares rivales
      cuando hay `rivalLastMatchdayResults` con diferencial de fuerza > 20 (Batch 13.2)
- [ ] **Nuevo** `veto-transfer.test.ts` — protección funciona; límite de 2; se limpia
      al cerrar temporada; jugador vetado no aparece en outgoing transfers (Batch 13.3)
- [ ] Golden master actualizado si cambia (`--update`) para 13.1
- [ ] Invariantes: `pnpm --filter @football-gm/engine test -- test/invariants.test.ts`

---

## Orden de implementación sugerido

```
13.5 (wageCap cleanup) → 13.1 (ascenso/descenso) → update golden →
13.4 (solidaridad) → 13.3 (veto) → 13.2 (titulares) → tests
```

Empezar por el cleanup más pequeño crea espacio mental y elimina ruido del typecheck.
Terminar con los titulares porque dependen de datos que 13.1 enriquece.
