# Fase 15 — Talento, Equilibrio y Mundo Vivo

Plan del nuevo ciclo de desarrollo. Origen: análisis de VirtuaFC (`virtua-fc-analisis-modo-comisionado.md`) contrastado con el estado real del engine. El objetivo **no es replicar VirtuaFC** — es traer las mecánicas que hacen que su mundo se sienta vivo, adaptadas al espíritu comisionado: el jugador moldea el ecosistema (reglas, dinero, estructura) y el ecosistema genera las historias.

---

## 0. Principios del ciclo

### Qué SÍ hacemos

1. **El comisionado nunca toma decisiones de club.** Tácticas, alineaciones, contratos individuales y fichajes se simulan de forma simple e invisible. Ninguna de estas simulaciones expone UI de gestión; solo producen consecuencias observables (resultados, titulares, traspasos, economía).
2. **Cada decisión de gobernanza debe tener consecuencias de largo plazo en el ecosistema.** Es la lección central de VirtuaFC: la rejugabilidad no viene del contenido, viene de que el estado del mundo es una función continua de decisiones pasadas.
3. **Kernel puro + orquestador.** Se mantiene la arquitectura functional core / imperative shell. Todo lo nuevo son funciones puras `(GameState) → GameState` o mutaciones in-place dentro de `closeSeason` (convención existente).
4. **Cada sistema estocástico nuevo usa su propio stream de RNG**, siguiendo el patrón existente (`transfersRng`, `mandatesRng`, `cupsRng`, `eventsRng`, `attributionRng`): seed derivado del seed de partida vía constante XOR. Así el golden master solo cambia cuando un bloque lo cambia deliberadamente, no por arrastre.
5. **Golden master: una actualización deliberada por bloque.** Cada bloque que altere salidas observables termina con un único `--update` revisado; nunca actualizaciones intermedias sin revisar el diff.

### Qué NO hacemos (fuera de alcance permanente)

- Tácticas, presión, mentalidad, formaciones — ni siquiera simuladas explícitamente. La "táctica" de un club es su `strength` y ya.
- Alineaciones por partido. El "rol en plantilla" (titular/rotación/suplente) se **deriva** del ranking de calidad dentro del plantel a nivel de temporada; nunca se simula quién jugó cada partido.
- Negociación de contratos individuales, cláusulas, agentes.
- Scouting con rangos de potencial visibles. El potencial es **oculto incluso para el comisionado**; solo se revela indirectamente vía titulares, premios y rendimiento.
- Moral/fitness de jugadores más allá de lo existente (lesiones/sanciones).

---

## Resumen de bloques y orden de implementación

| # | Bloque | Tipo | Tamaño | Depende de |
|---|--------|------|--------|------------|
| R1 | Pipeline de procesadores para `closeSeason` | Refactor (sin cambio de gameplay) | M | — |
| A | Tubería de talento: potencial oculto, desarrollo por rol, cantera anual, fuga/retención | Gameplay | L | R1 |
| B | Reparto → equilibrio competitivo | Gameplay | M | R1 (A recomendado) |
| C | Prestigio estructural con regresión a base | Gameplay | M | B |
| D | Partidos destacados (fidelidad rica derivada) | Narrativa | M | — (independiente) |
| R2 | Interfaz `CompetitionHandler` para formatos | Refactor futuro | — | Se documenta; se implementa cuando llegue el 4º formato |

**Orden recomendado: R1 → A → B → C → D.** R1 primero porque A, B y C insertan pasos nuevos en el cierre de temporada y el pipeline hace esas inserciones triviales y seguras. C va después de B porque el equilibrio competitivo alimenta los componentes del prestigio. D es independiente y puede intercalarse cuando convenga.

---

## R1 — Refactor: `closeSeason` como pipeline de procesadores

**Problema.** `closeSeason` (engine.ts:888+) es un monolito de ~200 líneas que invoca ~15 sistemas en un orden implícito (penalizaciones → standings → premios → economías de club → economía federación → gobernanza → prestigio → historia → crónica → trayectorias → eventos → desarrollo de jugadores → fuerza de equipos → récords → coeficientes → …). Añadir un sistema nuevo exige leer y tocar el monolito; el orden es frágil.

**Patrón VirtuaFC.** 17 procesadores de cierre + 7 de apertura, cada uno una clase pequeña con `priority()`, ejecutados en serie. Añadir un sistema = añadir una clase con un número.

### Diseño

Nuevo módulo `packages/engine/src/season-pipeline.ts`:

```ts
export interface SeasonCloseContext {
  // Datos que un paso publica y otro consume (patrón "metadata bag" tipado).
  standingsByOrden: Map<number, StandingRow[]>;
  prestigeDelta: number;            // acumulador; cada paso puede sumar/restar
  // Bolsa para claves ad-hoc entre pasos, sin acoplar tipos:
  meta: Map<string, unknown>;
}

export interface CloseSeasonStep {
  name: string;        // para logs/depuración
  priority: number;    // orden de ejecución ascendente
  run(s: GameState, ctx: SeasonCloseContext): void;  // muta s in-place (convención actual)
}
```

`closeSeason` queda reducido a: guardas de fase → `structuredClone` → construir `ctx` → ejecutar los steps ordenados → devolver `s`.

### Reglas de extracción

1. **Extraer los pasos actuales en el orden EXACTO en que hoy se ejecutan**, con prioridades espaciadas (10, 20, 30…) para poder intercalar luego.
2. Prohibido reordenar, fusionar o dividir lógica en este refactor. Cada step es copy-paste del bloque actual.
3. El acumulador de `delta` de prestigio pasa a `ctx.prestigeDelta`; el paso que hoy aplica `s.prestige = max(0, prestige + delta)` se convierte en el step `apply-prestige` con su prioridad actual.
4. Los pasos que hoy comparten variables locales (p. ej. `standingsByOrden`, `top`, `topTeams`) las leen de `ctx` (campos tipados) o de `ctx.meta` (claves puntuales, p. ej. `'title-race-gap'`).

### Criterio de aceptación

- **El golden master NO cambia.** `pnpm --filter @football-gm/engine test -- test/golden.test.ts` pasa sin `--update`. Este es el test del refactor.
- Todos los tests unitarios e invariantes existentes pasan sin modificación.
- (Opcional, segunda pasada del ciclo) mismo tratamiento para `startSeason`.

### Tocado

- `packages/engine/src/season-pipeline.ts` (nuevo), `engine.ts` (closeSeason adelgaza), `index.ts` (exportar tipos si los tests los necesitan).
- Sin cambios en contracts, backend ni frontend. Sin migración de schema.

---

## A — Tubería de talento

**El bloque de mayor impacto del ciclo.** Hoy el desarrollo de jugadores (engine.ts:1013-1039) es una curva plana idéntica para todos: <27 mejora +0..2, 27-31 estable ±1, 32+ declina. Ningún jugador puede ser especial; la "revelación" de la crónica es cosmética; y no hay ingesta anual de canteranos para equipos existentes, así que los planteles solo se erosionan con los retiros.

**Lección VirtuaFC adaptada:** `potencial oculto → desarrollo según participación → consecuencias en el ecosistema`. La torsión comisionado: la participación de los jóvenes no la decide el jugador (no hay alineaciones) — **la moldean sus normas** (`minimo_cantera`, `tope_edad_media`). La gobernanza pasa a determinar qué talento se desarrolla en tu liga.

### A1. Modelo de datos

En `Player` (types.ts:214):

```ts
export interface Player {
  // ... campos existentes ...
  // Techo de calidad alcanzable (oculto: NUNCA se serializa en DTOs de
  // contracts ni se muestra en UI). Solo el engine lo lee.
  potencial: number;   // clamp: calidad ≤ potencial ≤ 95
}
```

En `GameState`:

```ts
  // Talento (Fase 15): stream independiente para desarrollo, cantera,
  // fugas y retención — golden-safe respecto al resto de sistemas.
  talentRng: RngState;
```

### A2. Generación de potencial

Se genera al crear cualquier jugador (world-generator, canteranos nuevos, rosters rivales) como `potencial = clamp(calidad + margen, calidad, 95)`, con `margen` de cola pesada:

| Probabilidad | Margen | Lectura |
|---|---|---|
| 60% | 0–5 | jugador del montón |
| 25% | 6–12 | proyectable |
| 10% | 13–22 | promesa |
| 4% | 23–32 | joya |
| 1% | 33–40 | talento generacional |

Ajustes:
- Jugadores de 27+ años en el momento de la creación: `margen = 0..3` (su potencial ya está realizado).
- Canteranos de equipos con `academia` alta: la tirada de margen se hace **dos veces y se toma la mejor** si `academia ≥ 70` (las buenas academias producen más joyas, no jugadores medios mejores).

Para partidas existentes ver A8 (migración).

### A3. Rol en plantilla (participación sin alineaciones)

Se calcula al cierre de temporada, por equipo, ordenando el plantel por `calidad` descendente:

| Rango | Rol | Factor de participación |
|---|---|---|
| 1–11 | titular | 1.0 |
| 12–16 | rotación | 0.6 |
| 17+ | suplente | 0.3 |

**Enganche con gobernanza** (el corazón del bloque): si la federación del equipo tiene una norma `minimo_cantera` o `tope_edad_media` **activa y cumplida** por ese equipo esa temporada, los jugadores de ≤21 años del plantel reciben `+0.25` al factor (cap 1.0). Interpretación: la norma fuerza a los clubes a dar minutos a los jóvenes. Esto convierte esas dos normas en herramientas de desarrollo de talento a largo plazo, no solo en restricciones.

No se simula ningún partido individual: es una abstracción a nivel de temporada, coherente con "sin tácticas ni alineaciones".

### A4. Nueva curva de desarrollo (reemplaza engine.ts:1013-1026)

Ejecutada en el step `player-development` del pipeline (misma posición que el bloque actual). Todo con `talentRng`:

- **Crecimiento (edad ≤ 21):** `ganancia = randInt(0, 3) × factor + bonusAcademia`, con `bonusAcademia = round(academia / 25)` (1–4, solo si el equipo tiene `academia`), **capado por `potencial`**.
  - *Explosión de joya:* si `potencial − calidad ≥ 15`, probabilidad 15% de ganancia extra `randInt(4, 7)`. Es lo que genera el titular "aparece un crack".
- **Desarrollo (22–26):** `ganancia = randInt(0, 2) × factor`, cap `potencial`.
- **Pico (27–30):** `±1` como hoy.
- **Declive (31+):** `−randInt(1, 3)` como hoy, suelo 20.
- **Retiro:** igual que hoy (`age > 37 || calidad < 25`) + retiro temprano: 35–37 años con probabilidad 15% anual.
- El bonus de academia actual para ≤23 (engine.ts:1031-1039) **se elimina** — queda absorbido en `bonusAcademia` de la fase de crecimiento (evita el doble conteo actual).

La consecuencia sistémica: una liga cuyas normas hacen jugar a los jóvenes desarrolla más `calidad` agregada → `teamStrengthFromSquad` sube → mejores coeficientes y prestigio. Gobernanza → ecosistema, sin que el comisionado toque un solo jugador.

### A5. Ingesta anual de cantera

Hoy no existe regeneración de planteles (solo hay creación en world-generator, en `createTeam` y en rival-sim); con los retiros, los planteles se encogen indefinidamente. Nuevo step `youth-intake` (después de retiros):

- Cada equipo compitiendo (con plantel trackeado) recibe **1–2 canteranos** por temporada: edad 16–18, `cantera: true`, `nationality: 'local'` (90%; 10% `'extranjero'` para academias con captación exterior).
- `calidad` inicial: `clamp(round(youthStrength × 0.55 + randInt(-5, 5)), 20, 55)`.
- `potencial`: según tabla A2 con el bono de academia ≥ 70.
- Nombres via `names.ts`. Ids via `s.nextPlayerId++`.
- Cap de plantel: si el equipo supera ~26 jugadores tras la ingesta, los peores suplentes de 30+ años se retiran (limpieza natural).

### A6. Fuga y retención de talento

Nuevo step `talent-flight` al cierre de temporada, tras el desarrollo. Es el freno/premio de snowball más narrativo del juego y refuerza los coeficientes:

**Fugas (te roban cracks):**
- Candidatos: jugadores con `calidad ≥ 80` en equipos de la federación del jugador.
- Para cada candidato, probabilidad de fuga:
  `p = clamp(0.05 + (maxPrestigioRival − prestigioJugador) / 400, 0, 0.35) × (1 − arraigo_equipo / 200)`
  (el `arraigo` del club a la federación también retiene a sus estrellas; un club arraigado pelea por quedarse a su joya).
- Máximo 2 fugas por temporada (evita el vaciado).
- Efectos: el jugador pasa a un equipo top de la federación rival de mayor prestigio (roster de rival-sim); `TransferEntry` con fee `calidad × 250_000` que **entra a la tesorería del club vendedor** (consuelo económico); titular tipo *"Fuga: [X] se marcha a [FedRival]"*; entrada en el federation log.
- Sin efecto directo en prestigio (ya está implícito: perdiste calidad → peor liga → peores deltas futuros). No doble-contar.

**Retención/atracción (efecto inverso):**
- Si `prestigioJugador − maxPrestigioRival ≥ 15`: 0–2 estrellas de rosters rivales (calidad 78–88) llegan a los equipos top de tu D1 por temporada, con la misma mecánica espejo (fee sale de la tesorería del club comprador; si no puede pagar, no ficha).
- Titular tipo *"[X] elige la [TuLiga]: la liga que todos miran"*.

Ambos sentidos usan `talentRng` y respetan el guard de contaminación de divisiones (los jugadores que llegan se asignan a equipos con `federationId === playerFederationId`; los que se van, al roster rival correspondiente).

### A7. Integración narrativa y premios

- **Nuevo `AwardType`: `'mejor_joven'`** (awards.ts:326) — mejor temporada estadística entre jugadores ≤ 21. Con la curva nueva, este premio señala joyas reales.
- **Titulares nuevos** (headlines.ts): joya emergente (explosión A4), fuga (A6), fichaje estrella entrante (A6), *"la cantera de [X] no para de producir"* (equipo con ≥ 3 canteranos titulares).
- **Crónica** (`buildChronicle`): la "revelación" pasa a elegirse entre jóvenes con mayor salto de calidad en el año (dato ahora real, no cosmético).

### A8. Migración de schema (v13)

En `migrations.ts`, bump `CURRENT_SCHEMA_VERSION` a 13:

```ts
// v13 — Fase 15A: potencial oculto + talentRng
if (state.schemaVersion < 13) {
  if (!state.talentRng) state.talentRng = rngCreate(state.seed ^ 0x7A1E27);  // constante propia, patrón mandatesRng
  for (const p of state.players ?? []) {
    if (p.potencial === undefined) {
      // Determinista por jugador (no consume talentRng): margen pseudo-aleatorio
      // sembrado con (seed XOR id) para no perturbar ningún stream vivo.
      p.potencial = derivePotencialForExisting(state.seed, p);
    }
  }
}
```

`derivePotencialForExisting` usa la tabla A2 con un Mulberry32 efímero sembrado por jugador. Partidas viejas quedan indistinguibles de nuevas.

### A9. Contracts / Backend / Frontend

- **Contracts:** `potencial` NO se añade a ningún DTO de jugador (regla de ocultación). Sí se añaden: `mejor_joven` al enum de awards, los nuevos tipos de headline si el front discrimina por tipo, y `TransferEntry` ya soporta las fugas (mismo shape).
- **Backend:** sin endpoints nuevos. `GameStateRepository.engineToDbPlayer` (proyección relacional) tampoco persiste `potencial` — vive solo en el JSONB.
- **Frontend:**
  - `TeamDetailPage`: columna de edad ya existente; añadir chip de rol (titular/rotación/suplente) — derivable en el back al construir el DTO del plantel.
  - `TransfersPage`/`MarketPage`: sección "Fugas y llegadas internacionales" (filtro de `TransferEntry` cross-federación).
  - `DashboardPage`: los titulares nuevos entran por el flujo existente.

### A10. Tests

- Nuevo `packages/engine/test/talent.test.ts`:
  - crecimiento se detiene en `potencial`; explosión de joya solo si gap ≥ 15;
  - factor de participación: titular > rotación > suplente en esperanza de crecimiento;
  - norma `minimo_cantera` cumplida ⇒ jóvenes crecen más que en escenario espejo sin norma (test A/B con mismo seed);
  - ingesta de cantera mantiene tamaño de plantel estable a 10 temporadas;
  - fugas: prestigio bajo ⇒ ≥ 1 fuga esperada en N seeds; prestigio alto ⇒ llegadas; cap de 2 fugas.
- `invariants.test.ts`: añadir `calidad ≤ potencial ≤ 95` para todo jugador en toda temporada; plantel de todo equipo compitiendo ≥ 15 jugadores tras 10 temporadas.
- **Golden master: se actualiza una vez al final del bloque** (el desarrollo dejó de consumir `state.rng` y pasó a `talentRng` — esto por sí solo cambia el snapshot). Revisar el diff: las tablas/campeones cambian, la estructura no.

---

## B — Reparto y equilibrio competitivo

**Problema.** Las piezas existen pero el bucle está abierto: los premios configurables (`prizes.ts`, shares por competición) pagan a las tesorerías de los clubes, y el delta de prestigio ya premia ligas cerradas (`titleRaceGap`, engine.ts:914-925)… pero **el dinero de los clubes no afecta su capacidad de fichar**: `runTransferWindow` (transfers.ts:54) pondera compradores solo por `strength` y descuenta el fee de la tesorería sin comprobar si pueden pagarlo (transfers.ts:109).

**Bucle a cerrar (VirtuaFC §1: "los bucles económicos y deportivos se retroalimentan"):**

> reparto plano → clubes chicos con dinero → fichan → paridad → liga cerrada → +prestigio
> reparto meritocrático → los grandes acumulan → superequipos → liga aburrida → −prestigio (pero los grandes, contentos y con arraigo alto)

La pantalla de shares de premios pasa de configuración cosmética a **la decisión de diseño de liga más interesante del juego**.

### B1. Ventana de fichajes sensible a tesorería (transfers.ts)

1. **Gate de solvencia:** el fee se calcula *antes* de la aceptación; si `buyer.treasury < fee`, el intento falla (se quema el rng para mantener el determinismo del stream, patrón ya usado en transfers.ts:90).
2. **Peso del comprador:** de `strength` a `strength × (0.5 + min(1.5, max(0, treasury) / 20_000_000))`. Un club rico dobla su presencia en el mercado; uno quebrado casi desaparece de él.
3. **Venta forzada:** si `teamFinancialHealth` del vendedor es crítica (economy.ts:226), su mejor jugador entra al pool de candidatos con peso ×3 y fee al 70% — los clubes ahogados malvenden. Genera titular (*"[X] malvende a su estrella para sobrevivir"*).
4. Sigue usando `transfersRng`. Ningún cambio de RNG streams.

### B2. Índice de equilibrio competitivo

Nueva función pura en `standings.ts`:

```ts
// 0 = liga totalmente desigual, 100 = máxima paridad.
// Basado en la desviación estándar de puntos de la D1 normalizada por
// jornadas jugadas, combinada con el titleRaceGap existente.
export function competitiveBalanceIndex(rows: StandingRow[], matchdays: number): number
```

- Se calcula al cierre por división y se guarda en el `history` entry del año (campo nuevo `balanceIndex?: number` — retrocompatible, opcional).
- **Prestigio:** el step de entretenimiento del pipeline (hoy solo `titleRaceGap`) añade `±1` según el índice: `≥ 70 → +1`, `≤ 35 → −1`. Complementa, no reemplaza, la lógica actual.
- **Arraigo:** los equipos del top 3 de D1 ganan `+2` de arraigo en temporadas de reparto meritocrático (definido como share del campeón ≥ 3× share del último) — a los grandes les gusta el modelo que los favorece. Es el trade-off: paridad vs. contentar a los poderosos.

### B3. Contracts / Backend / Frontend

- **Contracts:** `balanceIndex` opcional en el DTO de historia/estructura.
- **Backend:** sin endpoints nuevos; el índice viaja en las respuestas existentes de historia/estructura.
- **Frontend:**
  - `EconomyPage` o `PrizesPage`: card "Equilibrio competitivo" con el índice de la última temporada y sparkline de tendencia (usar el tema HUD existente).
  - `PrizesPage`: texto explicativo junto al editor de shares ("un reparto más plano tiende a igualar la liga; uno meritocrático concentra el poder") — comunicar el trade-off sin dictar la respuesta.

### B4. Tests

- `transfers.test.ts` (ampliar): club sin tesorería no ficha; venta forzada dispara con salud crítica; determinismo del stream preservado (mismo seed ⇒ misma ventana).
- Nuevo test de escenario en `economy.test.ts` o `talent.test.ts`: dos partidas con el mismo seed, una con shares planos y otra meritocráticos, a 8 temporadas ⇒ la desviación estándar de `strength` en D1 es menor con shares planos. Es EL test del bloque: prueba que el bucle está cerrado.
- Golden master: cambia (la ventana de fichajes decide distinto). Una actualización al final del bloque.

---

## C — Prestigio estructural con regresión a base

**Problema.** El prestigio es acumulación pura de deltas: un pico se queda para siempre y el snowball solo se frena con mecánicas externas. VirtuaFC lo resuelve con **regresión hacia una base**: los picos puntuales decaen; solo lo estructural sube el piso (premia sostenibilidad, no el pelotazo).

### C1. Base estructural (derivada, nunca almacenada — precedente `tierOf()`)

Nueva función pura en `engine.ts` o módulo propio:

```ts
export function prestigeBase(s: GameState): number
```

Suma acotada de factores **estructurales** (cosas lentas y caras de construir):

| Componente | Fórmula | Cap |
|---|---|---|
| Piso | 20 | — |
| Tamaño consolidado | `0.8 × equiposCompitiendo` | 16 |
| Infraestructura | `avg(stadiumCapacity) / 10_000` | 10 |
| Racha de gobernanza | `2 × temporadasConsecutivasCon(governanceBonus > 0)` | 10 |
| Coeficiente mundial | `lastRank ≤ 3 → 8; ≤ 6 → 5; ≤ 10 → 2` | 8 |
| Tradición | `1 × copasRecurrentesActivas + 0.5 × temporadasCerradas` | 8 |

(Los números son punto de partida; se calibran con el golden y partidas de prueba a 15+ temporadas. Requiere trackear la racha de gobernanza: campo nuevo `governanceStreak: number` en `GameState` — migración v14, default 0.)

### C2. Regresión al cierre

En el step `apply-prestige` del pipeline, después de aplicar el delta del año:

```ts
const base = prestigeBase(s);
s.prestige = Math.max(0, s.prestige + Math.round((base - s.prestige) * 0.15));
```

Lectura: una temporada brillante te lleva 12 puntos por encima de tu base ⇒ pierdes ~2/año hasta consolidar estructura. Estar por *debajo* de tu base te recupera solo (una mala temporada no arruina un proyecto sólido). `k = 0.15` es el parámetro a calibrar.

### C3. Recalibrar mandatos

Los mandatos de prestigio (`mandatesRng`, board) hoy asumen prestigio acumulativo. Ajustar la generación: objetivo `max(prestigioActual + 3, base + 5)` en lugar de deltas fijos, para que un directorio no pida imposibles contra la regresión ni regale objetivos ya alcanzados.

### C4. UI

- `DashboardPage`: junto al prestigio actual, mostrar la base ("Prestigio 58 · Base estructural 46") con tooltip desglosando los componentes de C1 — es información que el comisionado SÍ debe ver: le dice qué construir.
- El desglose de componentes viaja en el DTO del dashboard (contracts: `prestigeBreakdown`).

### C5. Tests

- Nuevo `prestige.test.ts`: la base es monótona con cada componente; la regresión converge (a delta 0, `|prestige − base|` decrece); prestigio nunca negativo.
- `invariants.test.ts`: a 12+ temporadas sin acciones del jugador, `|prestige − base| ≤ 25` (la regresión acota la deriva).
- Golden master: cambia. Actualización única con revisión de que las trayectorias de prestigio del snapshot sean *plausibles* (subidas por títulos, decaimiento posterior).

**Riesgo específico:** este bloque cambia el feel del juego entero. Antes de mergearlo, jugar una partida manual de 10+ temporadas y validar que los mandatos siguen siendo alcanzables y que el early game no se siente castigado. Es el bloque con más iteración de calibración esperada.

---

## D — Partidos destacados (fidelidad por niveles)

**Lección VirtuaFC §2:** mismo kernel, envolturas con distinto nivel de detalle según si alguien mira. Nuestro default ya es el nivel barato; falta el nivel **rico** para los partidos que el comisionado sí mira. Clave de diseño: **derivación pura, cero estado nuevo, cero RNG nuevo** — todo el detalle se construye desde datos que ya existen (`MatchReport` tiene goles con minuto, tarjetas; `state.rivalries`; rondas de copa; standings).

### D1. Criterios de "destacado" (función pura `isFeaturedMatch`)

1. Final o semifinal de copa (`cup.rounds`).
2. Derbi: la pareja está en `state.rivalries`.
3. Partido por el título: últimas 3 jornadas, ambos equipos en el top 3 de D1 con gap ≤ 3 puntos.
4. Drama intrínseco: goleada (margen ≥ 4), remontada (secuencia de goles con cambio de líder en el marcador), hat-trick de un jugador.

### D2. `buildFeaturedReport` (nuevo en headlines.ts o módulo `featured.ts`)

```ts
export function buildFeaturedReport(s: GameState, report: MatchReport): FeaturedReport | null
```

Devuelve `null` si no es destacado. Si lo es: cronología de momentos (goles con minuto y autor — ya existen en `goalscorers` —, expulsiones, "vuelco en el marcador"), etiquetas (`derbi`, `final`, `remontada`, `goleada`, `hat-trick`) y un párrafo narrativo con el sistema de plantillas de headlines.ts. **No se almacena en `GameState`** — se deriva bajo demanda. Golden master intacto.

### D3. Backend / Frontend

- **Backend:** los reports destacados de la última jornada se derivan al construir la respuesta de `POST /games/:id/advance` (o un `GET /games/:id/featured?matchday=N` en `history.controller.ts` si la respuesta de advance ya pesa mucho — decisión al implementar).
- **Contracts:** schema `FeaturedReport`.
- **Frontend:** card "Partido de la jornada" en `DashboardPage` (cronología vertical estilo HUD); en `CupsPage`, las finales enlazan a su report destacado.

### D4. Tests

- `featured.test.ts`: detección de remontada, hat-trick, derbi y final sobre `MatchReport`s construidos a mano; partidos anodinos ⇒ `null`.
- Sin impacto en golden ni invariantes (derivación pura).

---

## R2 — `CompetitionHandler` (documentado, no implementado)

El strategy pattern de VirtuaFC (interfaz de 4 métodos por tipo de competición) es el camino correcto **cuando el comisionado diseñe formatos**: formato suizo, playoff de ascenso, apertura/clausura, supercopa. Hoy, con liga + 3 formatos de copa, `cups.ts` aguanta.

**Regla de disparo:** el primer formato nuevo que se pida se implementa extrayendo primero la interfaz (`schedule`, `advanceRound`, `isFinished`, `winner`) y adaptando los formatos existentes a ella; nunca añadiendo otro `if (format === ...)` a `cups.ts`. Este párrafo existe para que esa decisión ya esté tomada.

También heredamos sus lecciones de deuda (§5 del análisis): **un solo punto de entrada** para avanzar el mundo (ya lo cumplimos: `advanceMatchday`) y **idempotencia en el orquestador central**, nunca repartida por handler.

---

## Reglas transversales del ciclo

1. **RNG:** todo azar nuevo de los bloques A/B usa `talentRng`/`transfersRng` según corresponda. Jamás `state.rng` (reservado al motor de partidos), `rivalRng` ni `mandatesRng`. Constantes XOR nuevas documentadas junto a las existentes.
2. **Migraciones:** v13 (talentRng + potencial, bloque A), v14 (governanceStreak, bloque C). Todos los defaults en `migrations.ts`, nunca en `loadState` ni ad-hoc. `CURRENT_SCHEMA_VERSION` se bumpea en el mismo PR que introduce el campo.
3. **Golden master:** un `--update` por bloque (A, B, C), como último commit del bloque, con el diff revisado y descrito en el mensaje de commit. R1 y D no deben tocarlo — si lo tocan, hay un bug.
4. **Checklist de acción nueva** (CLAUDE.md) aplica a cada endpoint/DTO nuevo: engine → export → contracts → controller → service transaction → api.ts → useMutation → tests → migración.
5. **Ocultación del potencial:** ningún DTO, proyección relacional, log ni titular imprime el valor numérico de `potencial`. Los titulares hablan de "joya", "promesa" — cualitativo, nunca el número.
6. **Cada bloque = un PR**, con su golden update (si aplica) al final. R1 es el primer PR del ciclo.
7. Al cerrar el ciclo: actualizar la tabla de módulos del engine y las mecánicas en `CLAUDE.md` (nuevo módulo de talento, pipeline, índice de equilibrio, prestigio base).

## Riesgos principales

| Riesgo | Mitigación |
|---|---|
| C cambia el feel global del juego | Calibrar con partidas manuales de 10+ temporadas antes de merge; `k` y la tabla de C1 son parámetros, no constantes sagradas |
| A infla la calidad media de la liga (todos crecen hacia potenciales altos) | La tabla A2 es 60% "del montón"; monitorear `avg(calidad)` en el test de invariantes a 10 temporadas (banda 45–65) |
| Fugas vacían la liga del jugador en el early game | Cap de 2 fugas/temporada + factor arraigo + suelo de probabilidad 0.05 |
| B hace que clubes quebrados entren en espiral de muerte | Ya existen `rescueTeam` y demandas de rescate — la venta forzada es precisamente la válvula de escape; test de escenario a 10 temporadas sin extinciones |
| R1 rompe el orden implícito de closeSeason | El golden master es el test; extracción literal sin reordenar |
