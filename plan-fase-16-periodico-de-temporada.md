# Fase 16 — El Periódico de Fin de Temporada

Plan del nuevo ciclo de desarrollo. Origen: petición directa del usuario — al cerrar
temporada, el resumen actual es una nota discreta (`SeasonChronicle` en un panel ámbar
al fondo de la pretemporada) y una lista de titulares de seis puntos en el Dashboard. El
usuario quiere que el cierre de temporada sea un momento: algo con forma de **periódico**
que resuma campeón, premios, economía, y noticias de otras federaciones — "con el estilo
del juego", es decir, la metáfora de periódico expresada con la identidad visual HUD
oscura que el juego ya tiene, no un skin literal de papel color crema.

**Decisiones ya cerradas con el usuario** (no vuelven a discutirse en este documento):

1. **Se persiste para siempre.** Nueva colección `s.seasonReports[]`, revisable después
   desde Historial ("Ediciones anteriores"). Coherente con la regla ya existente del
   juego: la historia es append-only.
2. **Aparece automático pero es fácil de saltar.** Se abre solo tras cerrar temporada;
   un click/Esc lo cierra sin pasos obligatorios. Nada de onboarding forzado de varias
   diapositivas.
3. **Las copas solo muestran marcador**, sin cronología minuto a minuto (`CupMatch` no
   tiene datos de gol con minuto/autor — limitación ya documentada en Fase 15D como
   mejora futura, no forzada aquí).

---

## 0. Principios del ciclo

### Qué SÍ hacemos

1. **Es una capa de presentación sobre datos que ya existen.** La investigación previa a
   este plan confirma que prácticamente todo el contenido del periódico ya se calcula en
   algún punto de `closeSeason` — campeón, premios, economía, mandato, confianza de la
   junta, ranking mundial, campeones rivales, transferencias, récords. El trabajo real no
   es "calcular más cosas": es **capturarlas en el instante correcto antes de que se
   pierdan** (ver R1 más abajo) y **darles una presentación a la altura**.
2. **"Solo datos", pero dramatizados.** El principio no negociable del juego (`README.md`
   línea 27: *"la interfaz es de solo datos —tablas, listas y números, sin motor 3D—"*)
   se mantiene. El periódico es tipografía, jerarquía visual, color y estructura de
   columnas — no ilustraciones, no avatares, no "motor de partido visual". Es la misma
   regla que ya sigue `headlines.ts`, llevada a una pantalla dedicada.
3. **Instantánea inmutable, no vista derivada.** A diferencia de `featured.ts` (Fase 15D,
   deriva bajo demanda, cero estado nuevo), el periódico **debe** materializarse como
   estado persistido en el momento del cierre. Motivo (verificado en el engine, no
   asumido): `s.results` y `s.matchReports` se vacían en el mismo `closeSeason`
   (`reset-for-pretemporada`, prioridad 290) y `s.lastEconomy` / `s.globalRankings` /
   `s.recordBook` son valores **singulares** que la temporada siguiente sobrescribe. Si no
   se captura una copia en el instante del cierre, la temporada 3 es irrecuperable estando
   ya en la temporada 5.
4. **Cero RNG nuevo, cero cambio de golden.** Los pasos nuevos del pipeline solo *leen*
   valores que otros pasos ya calcularon (o hacen una relectura barata de `s.results` /
   `s.matchReports` mientras siguen vivos) y escriben en un array nuevo que el golden
   master no inspecciona. Ningún paso existente cambia de comportamiento.
5. **Reutilizar antes que reinventar.** El "partido del año" del periódico reutiliza
   literalmente `featured.ts` (Fase 15D, recién enviado) en vez de crear un sistema de
   detección de partidos destacados paralelo. Los "breves" de sociedad reutilizan
   `federationLog`. La sección de mundo reutiliza `rivalSeasonRecords`. Nada de esto es
   casualidad: es la señal de que el periódico es el remate natural de los últimos dos
   ciclos, no una feature aislada.

### Qué NO hacemos (fuera de alcance de este ciclo)

- Cronología minuto a minuto de finales de copa (decisión ya tomada arriba). El primer
  formato de copa que lo necesite de verdad es quien debe justificar enseñar a
  `cups.ts` a emitir `MatchReport`s — no se fuerza aquí.
- Texto generado por LLM. El `diseno-simulador-liga.md` (histórico, ya borrado del repo,
  recuperado vía git para este análisis) sembró esa idea como "Fase 3 — análisis e IA" y
  la descartó explícitamente para el prototipo; seguimos con texto por plantillas, como
  `headlines.ts` ya hace.
- Portadas o secciones configurables por el jugador. El periódico es un artefacto fijo
  que el motor produce; no hay editor de maquetación.
- Cambiar `SeasonChronicle` o `HeadlinesFeed` existentes. El periódico los **absorbe**
  como una de sus secciones (ver B1), pero ambos siguen existiendo tal cual para quien
  no abre el periódico — cero regresión visual en el Dashboard actual.
- Cualquier trabajo no relacionado con el periódico, aunque esté en el backlog (p. ej.
  los 4 gaps de producción de baja prioridad ya registrados aparte). Ciclo enfocado.

---

## Resumen de bloques y orden de implementación

| # | Bloque | Tipo | Tamaño | Depende de |
|---|--------|------|--------|------------|
| R1 | Modelo de datos: `SeasonReport` + migración schema v15 | Datos | S | — |
| A | Motor: captura en el pipeline de `closeSeason` (prescan + ensamblado) | Gameplay/Narrativa | L | R1 |
| B | Contracts + Backend: DTO, endpoint de lectura, respuesta de close-season | Integración | S | A |
| C | Frontend: el Periódico (componente de revelación a pantalla completa) | UI | L | B |
| D | Frontend: Historial → "Ediciones anteriores" (hemeroteca) | UI | S | B, C |

**Orden recomendado: R1 → A → B → C → D.** R1 y A son inseparables en la práctica (el
tipo se diseña junto con lo que lo llena) pero se listan aparte porque R1 es pura
definición de datos + migración (revisable en un commit propio, sin lógica) y A es el
trabajo real del pipeline. C depende de B porque el componente visual necesita el DTO
real, no un mock. D reutiliza el componente de C en modo lectura, así que va al final.

---

## R1 — Modelo de datos: `SeasonReport`

### R1.1 Por qué existe

Verificado directamente en `season-pipeline.ts` y `engine.ts` (no asumido): el orden de
pasos de `closeSeason` es, en las prioridades que importan aquí,

```
... 240 board-confidence
250 record-book
260 year-bump-and-negotiations      ← s.year += 1 (¡ya avanzó!)
270 transfer-window
280 promotion-relegation
290 reset-for-pretemporada          ← s.results = []; s.matchReports = []
300 cups-finalize-and-phase         ← fuerza campeones de copas inacabadas
```

Y estos campos de `GameState` son **singulares**, no históricos — la temporada N+1 los
pisa:

- `lastEconomy: LastEconomy | null`
- `recordBook: RecordBook | null` (guarda el récord *de siempre*, no "el de esta
  temporada" si no fue récord)
- `globalRankings: GlobalRanking[]` (se reconstruye entero cada `computeGlobalRanking`)

Conclusión de diseño: el periódico **debe** ensamblarse dentro del mismo `closeSeason`
que lo genera, en dos puntos distintos del pipeline (ver Bloque A), y el resultado se
guarda tal cual — no se puede reconstruir después con precisión.

### R1.2 Tipo nuevo (`packages/engine/src/types.ts`)

```ts
export interface SeasonReportAward {
  tipo: AwardType;               // 'max_goleador' | 'max_asistente' | 'mejor_portero' | 'mejor_joven'
  playerName: string;
  teamName: string;
  valor: number;
}

export interface SeasonReportCupResult {
  cupId: number;
  name: string;
  tipo: CupType;
  formato: CupFormat;
  championTeamName: string;
  runnerUpTeamName: string | null;   // derivado de la última ronda; null si no aplica (liga)
}

export interface SeasonReportRivalBrief {
  federationId: number;
  federationName: string;
  championName: string;
  runnerUpName: string | null;
  topScorer: { name: string; teamName: string; goals: number } | null;
  cupWinnerName: string | null;
  promoted: string[];
  relegated: string[];
}

export interface SeasonReportMandate {
  description: string;
  met: boolean;
}

export interface SeasonReportBoardConfidence {
  before: number;
  after: number;
  reasons: string[];   // de BoardConfidenceEntry.reason, filtradas por año
}

export interface SeasonReportEconomy {
  // Copia literal de LastEconomy en el instante del cierre — el original se
  // sobrescribe la temporada siguiente, así que esto es la única fuente
  // fiable después de avanzar más temporadas.
  income: number;
  operatingCost: number;
  normCost: number;
  prizes: number;
  talent: number;
  net: number;
  transferFees: number;
  transferIncome: number;
  matchday: number;
  merchandise: number;
  treasuryAfter: number;
}

export interface SeasonReport {
  year: number;                  // año YA CERRADO (s.year en el pipeline ya avanzó — ver A2)
  generatedAtMatchday: number;   // 0, informativo (cierre siempre es post-temporada)

  // ── Portada ──────────────────────────────────────────────────────────
  headline: string;              // reutiliza SeasonChronicle.headline
  champion: { teamId: number; name: string; points: number };
  revelation: { teamId: number; name: string; reason: string } | null;
  disappointment: { teamId: number; name: string; reason: string } | null;
  balanceIndex: number | null;   // índice de equilibrio competitivo de D1 (Fase 15B)

  // ── Estado de la federación ─────────────────────────────────────────
  prestige: { before: number; after: number; delta: number };
  boardConfidence: SeasonReportBoardConfidence;
  mandate: SeasonReportMandate | null;
  structuralNotes: string[];     // "X asciende a 1ª", "Y desciende", "Z abandona la federación"

  // ── Deportes ─────────────────────────────────────────────────────────
  awards: SeasonReportAward[];
  cupResults: SeasonReportCupResult[];
  featuredMatch: FeaturedReport | null;   // reutiliza el tipo de featured.ts tal cual

  // ── Récords ──────────────────────────────────────────────────────────
  // Lo mejor DE ESTA temporada, sea o no récord histórico (RecordBook solo
  // guarda el histórico). Null si la temporada no tuvo partidos jugados.
  biggestWinThisSeason: {
    margin: number; homeName: string; awayName: string;
    homeGoals: number; awayGoals: number;
  } | null;
  allTimeRecordBrokenThisSeason: {
    type: 'biggestWin' | 'longestWinStreak';
    detail: string;
  }[];   // vacío si esta temporada no batió ningún récord histórico

  // ── Economía ─────────────────────────────────────────────────────────
  economy: SeasonReportEconomy | null;
  notableTransfers: TransferEntry[];   // top 3 por transferFee, filtradas por year

  // ── Mundo ────────────────────────────────────────────────────────────
  worldNews: SeasonReportRivalBrief[];         // de rivalSeasonRecords, filtrado por year
  globalRankingTop5: GlobalRanking[];          // copia de globalRankings (ya es snapshot único)
  playerFederationGlobalRank: number | null;   // posición propia dentro de globalRankingTop5/snapshot completo

  // ── Breves ───────────────────────────────────────────────────────────
  briefs: { type: FederationLogType; title: string; detail: string; teamId: number | null }[];
}
```

Notas de diseño del tipo:

- **`featuredMatch: FeaturedReport | null` reutiliza el tipo de `featured.ts` sin
  modificarlo.** Ahorra duplicar `FeaturedMoment`/`FeaturedTag` y mantiene una sola
  fuente de verdad para "qué hace destacado a un partido".
- **`biggestWinThisSeason` es un campo nuevo, distinto de `RecordBook`.** `RecordBook`
  solo se actualiza si el resultado bate el récord de *todas* las temporadas — una
  temporada sin partidos históricos igual quiere poder decir "la mayor goleada del año
  fue 5-0", aunque no sea un récord absoluto.
- **`potencial` de jugadores NO aparece en ningún campo.** Ocultación ya establecida en
  Fase 15A se mantiene sin excepción — el periódico habla de "promesa"/"joya" vía
  `awards`/`briefs`, nunca expone el número.

### R1.3 Campo nuevo en `GameState`

```ts
// Fase 16: hemeroteca — una instantánea inmutable por temporada cerrada,
// capturada en el momento exacto del cierre (ver season-pipeline.ts). Nunca
// se muta después de creada.
seasonReports: SeasonReport[];
```

### R1.4 Migración (`migrations.ts`, `CURRENT_SCHEMA_VERSION` → 15)

```ts
// v15 — Fase 16: hemeroteca de periódicos de fin de temporada.
if (state.schemaVersion < 15) {
  if (!state.seasonReports) state.seasonReports = [];
}
```

Retrocompatible por diseño: partidas viejas simplemente no tienen ediciones anteriores
hasta que cierren su primera temporada tras el upgrade. Nada que backfillear (a
diferencia del caso de `potencial` en Fase 15A) porque los datos crudos de temporadas
pasadas ya no existen (ver R1.1) — no hay forma honesta de reconstruir un periódico
retroactivo, y no lo intentamos.

### R1.5 Tocado

- `packages/engine/src/types.ts` (tipos nuevos + campo en `GameState`).
- `packages/engine/src/migrations.ts` (bump a v15 + default `[]`).
- Sin cambios en contracts, backend ni frontend todavía (eso es B/C/D).

---

## A — Motor: captura en el pipeline de `closeSeason`

### A1. Por qué dos pasos y no uno

El force-completado de copas inacabadas ocurre en `cups-finalize-and-phase` (prioridad
300), que es **posterior** a `reset-for-pretemporada` (290, donde se vacían `s.results`/
`s.matchReports`). Eso significa que ningún paso único puede, a la vez, (a) leer
resultados de partidos crudos (que mueren en 290) y (b) leer campeones de copa
garantizados-finales (que no están listos hasta 300). Se necesitan dos pasos:

1. **`season-report-prescan`** (prioridad 265 — después de `year-bump-and-negotiations`
   en 260, para que `s.year` ya sea el año siguiente y las relecturas usen `s.year - 1`
   consistentemente; antes de `reset-for-pretemporada` en 290). Lee `s.results` y
   `s.matchReports` mientras aún existen. Escribe su salida en `ctx.meta` (el bolso de
   mano tipado del pipeline, ya usado para handshakes puntuales entre pasos).
2. **`season-report-assemble`** (prioridad 305 — el nuevo último paso, después de
   `cups-finalize-and-phase` en 300). Lee `ctx.meta` (relleno por el paso anterior) más
   todos los arrays ya durables (`s.awards`, `s.cups`, `s.rivalSeasonRecords`,
   `s.lastEconomy`, `s.globalRankings`, `s.transfers`, `s.federationLog`, `s.mandates`,
   `s.boardConfidence`, `s.recordBook`) y empuja el `SeasonReport` final a
   `s.seasonReports`.

Ninguno de los dos pasos consume RNG ni muta ningún campo que el golden master inspeccione
(`state.history`) — son relectura pura + escritura en un array nuevo.

### A2. `season-report-prescan` (prioridad 265)

```ts
{
  name: 'season-report-prescan',
  priority: 265,
  run(s, ctx) {
    const reportYear = s.year - 1;   // year-bump-and-negotiations (260) ya incrementó

    // Mayor goleada DE ESTA temporada (no solo si es récord histórico).
    let biggestWinThisSeason: SeasonReport['biggestWinThisSeason'] = null;
    const byId = new Map(s.teams.map((t) => [t.id, t]));
    for (const r of s.results) {
      const margin = Math.abs(r.homeGoals - r.awayGoals);
      if (!biggestWinThisSeason || margin > biggestWinThisSeason.margin) {
        biggestWinThisSeason = {
          margin,
          homeName: byId.get(r.homeId)?.name ?? '—',
          awayName: byId.get(r.awayId)?.name ?? '—',
          homeGoals: r.homeGoals,
          awayGoals: r.awayGoals,
        };
      }
    }

    // Partido del año: reutiliza featured.ts tal cual, sobre TODOS los
    // MatchReport de la temporada (no solo el último jugado, a diferencia
    // de cómo se usaría en vivo). Prioriza por relevancia de tag, no por orden.
    const TAG_PRIORITY: Record<FeaturedTag, number> = {
      titulo: 4, derbi: 3, goleada: 2, remontada: 2, hat_trick: 1,
    };
    let best: { report: MatchReport; score: number } | null = null;
    for (const mr of s.matchReports) {
      if (!isFeaturedMatch(s, mr)) continue;
      const built = buildFeaturedReport(s, mr);
      if (!built) continue;
      const score = built.tags.reduce((acc, t) => acc + TAG_PRIORITY[t], 0);
      if (!best || score > best.score) best = { report: mr, score };
    }
    const featuredMatch = best ? buildFeaturedReport(s, best.report) : null;

    // "Antes" de ascensos/descensos — promotion-relegation (280) muta
    // divisionOrden DESPUÉS de este paso; sin esta foto, season-report-assemble
    // (305) no tiene con qué comparar el "después".
    const divisionOrdenBefore = new Map(
      s.teams
        .filter((t) => t.federationId === s.playerFederationId)
        .map((t) => [t.id, t.divisionOrden]),
    );

    ctx.meta.set('season-report:biggestWinThisSeason', biggestWinThisSeason);
    ctx.meta.set('season-report:featuredMatch', featuredMatch);
    ctx.meta.set('season-report:year', reportYear);
    ctx.meta.set('season-report:divisionOrdenBefore', divisionOrdenBefore);
  },
},
```

### A3. `season-report-assemble` (prioridad 305)

Ensambla el objeto final leyendo `ctx.meta` (del paso A2) y filtrando cada array
durable por `year === reportYear`:

- `champion`/`revelation`/`disappointment`/`headline`/`balanceIndex`: del último
  `s.seasonChronicles` con `year === reportYear` (ya escrito por el step existente
  `season-chronicle`, prioridad 100 — ocurre antes, en el mismo `closeSeason`).
- `prestige`: de `ctx.prestigeBefore`/`ctx.prestigeDelta` (ya en `ctx`, no en `ctx.meta`
  — son campos tipados del `SeasonCloseContext` existente) + `s.prestige` actual.
- `boardConfidence`: `s.boardConfidence.history.filter(h => h.year === reportYear)` →
  `reasons`; `before`/`after` de los extremos de esa ventana.
- `mandate`: `s.mandates.find(m => m.year === reportYear)`.
- `structuralNotes`: **solo cubre ascensos/descensos** (`promotion-relegation`, 280).
  Los abandonos de federación (`exodus`, 210) ya quedan cubiertos sin trabajo extra:
  `processExodus` corre antes que `season-report-prescan` (265) y escribe una entrada
  `team_left` en `federationLog`, que `briefs` ya recoge (filtrado por año) — repetirlo
  en `structuralNotes` sería redundante.

  Ascensos/descensos SÍ necesitan una pieza que el diseño no tenía: `promotion-relegation`
  (280) muta `divisionOrden` **después** de `season-report-prescan` (265) y **antes** de
  `season-report-assemble` (305), así que ninguno de los dos ve ambos lados del cambio
  por sí solo. `season-report-prescan` (A2) gana una línea más — captura el "antes":

  ```ts
  ctx.meta.set(
    'season-report:divisionOrdenBefore',
    new Map(
      s.teams
        .filter((t) => t.federationId === s.playerFederationId)
        .map((t) => [t.id, t.divisionOrden]),
    ),
  );
  ```

  `season-report-assemble` (A3) compara esa foto contra el `divisionOrden` actual de
  cada equipo (ya mutado por 280) para derivar "X asciende a 1ª" / "Y desciende a 2ª".
- `awards`: `s.awards.filter(a => a.year === reportYear)`.
- `cupResults`: `s.cups.filter(c => c.year === reportYear && c.status === 'finalizada')`,
  mapeado con `runnerUpTeamName` derivado **según formato** — no hay una sola regla:
  - `eliminatoria` / `eliminatoria_ida_vuelta`: el perdedor del partido/agregado de la
    última ronda (`cup.rounds.at(-1)`, ya con `winnerTeamId` resuelto).
  - `liga`: **no hay "última ronda que decide"** — recordar de la propia sesión que
    generó `CupsPage.tsx`/`cups.ts` en este mismo ciclo que un cup `liga` juega **todo**
    su round-robin en un único `CupRound`. El runner-up es el 2º en la clasificación
    calculada sobre `cup.rounds[0].matches`, con la misma lógica que ya existe (y no se
    reimplementa) en `computeCupStandings` (`apps/frontend/src/routes/CupsPage.tsx`) —
    portar esa función (o una equivalente) al engine si se prefiere no depender de
    lógica de frontend, ya que aquí se necesita en el motor, no en la UI.
- `featuredMatch`, `biggestWinThisSeason`: de `ctx.meta` (paso A2).
- `allTimeRecordBrokenThisSeason`: comparar `s.recordBook.biggestWin?.year` y
  `s.recordBook.longestWinStreak?.year` contra `reportYear` — si coinciden, esta
  temporada SÍ puso un récord histórico (el step `record-book`, prioridad 250, ya corrió
  antes en el mismo `closeSeason`).
- `economy`: copia literal de campos de `s.lastEconomy` (que en este instante todavía
  es el de `reportYear` — nadie lo ha vuelto a escribir).
- `notableTransfers`: **filtra por `s.year` (post-bump), no por `reportYear`.** `transfer-window`
  (270) corre DESPUÉS del bump de año (260) y estampa sus entradas con `s.year` —
  confirmado leyendo `transfers.ts` y el comentario propio de `getTransfers` en el
  backend ("`year` es la pretemporada de ese año"): la ventana que se acaba de ejecutar
  en este mismo cierre es la ventana de cierre de la temporada que este informe
  describe, aunque el motor la etiquete con el año siguiente. `s.transfers.filter(t => t.year === s.year).sort((a,b) => b.transferFee - a.transferFee).slice(0, 3)`.
  Es el único campo de esta lista que lee `s.year` en vez de `reportYear` — todos los
  demás se generan ANTES del bump (premios @90, crónica @100, rivales @220, mandato
  @230, confianza @240, historial @70).
- `worldNews`: `s.rivalSeasonRecords.filter(r => r.year === reportYear)`, mapeado 1:1
  (el tipo `RivalSeasonRecord` ya tiene casi todos los campos que necesita
  `SeasonReportRivalBrief` — falta `promoted`/`relegated`, que el tipo YA trae).
- `globalRankingTop5`: `s.globalRankings.slice(0, 5)` (ya es un snapshot único,
  recién recalculado en `year-bump-and-negotiations`, 260 — anterior a este paso).
- `playerFederationGlobalRank`: `s.globalRankings.find(r => r.federationId === s.playerFederationId)?.rank ?? null`.
- `briefs`: `s.federationLog.filter(e => e.year === reportYear)`, tal cual (ya son
  entradas narrativas listas). Nota menor: `year-bump-and-negotiations` (260) corre
  ANTES de `season-report-prescan` (265), así que cualquier entrada de log que ese
  mismo paso genere (p. ej. una negociación que se vuelve efectiva vía
  `progressNegotiations`) ya lleva el año nuevo (`reportYear + 1`) y por tanto no
  aparece en `briefs` de esta edición — es correcto (ese hecho pertenece a la temporada
  que empieza, no a la que cierra), no requiere ajuste.

### A4. Registro en `closeSeasonSteps`

Dos entradas nuevas en el array de `engine.ts` (import de `season-pipeline.ts` sigue
igual, solo se añaden objetos al array existente — cero riesgo de reordenar nada).

### A5. Tests (`packages/engine/test/season-report.test.ts`, nuevo)

- Cerrar una temporada con jugadores cargados y copas configuradas → `s.seasonReports`
  tiene exactamente una entrada nueva, `year === año recién cerrado` (no el `s.year`
  post-bump).
- `biggestWinThisSeason` refleja el partido correcto aunque NO sea récord histórico
  (escenario: temporada con una goleada de 5-0 en un save cuyo récord histórico ya es
  7-0 de una temporada anterior — `biggestWinThisSeason` debe ser 5-0,
  `allTimeRecordBrokenThisSeason` debe estar vacío).
- `featuredMatch` selecciona el partido de mayor prioridad de tag cuando hay varios
  candidatos en la misma temporada (script: un derbi + una goleada en la misma
  temporada → gana el que tenga más tags acumulados según `TAG_PRIORITY`).
- Copa forzada a completarse en `cups-finalize-and-phase` (300) aparece igual en
  `cupResults` (prueba explícita de que el orden de pasos elegido — ensamblar en 305,
  después de 300 — es necesario: si se ensamblara antes, este test fallaría).
- `worldNews` no incluye datos de la federación del jugador (guard de contaminación de
  división, coherente con el resto del código).
- **Golden master: NO cambia.** `pnpm --filter @football-gm/engine test -- test/golden.test.ts`
  pasa sin `--update`. Es el criterio de aceptación de todo el bloque A, igual que R1 en
  Fase 15.
- `invariants.test.ts`: añadir que `s.seasonReports.length === número de veces que
  cerró temporada con jugadores cargados` tras N temporadas simuladas con
  `advanceSeason` + `closeSeason` en bucle.

---

## B — Contracts + Backend

### B1. Contracts (`packages/contracts/src/index.ts`)

Un `SeasonReportDto` que espeja `SeasonReport` 1:1 (mismo patrón que el resto de DTOs:
Zod object con los mismos campos, sin lógica). Reutiliza los schemas Zod que ya existen
para tipos compartidos (`AwardType`, `CupType`, `CupFormat`, `FederationLogType`). Fase
15D ("partidos destacados") se implementó **solo en el engine** — la nota de esa fase en
memoria del proyecto es explícita: "se salta a propósito endpoints backend y wiring de
frontend para la superficie 'nice to have' de cada bloque". Confirmado: no existe
`FeaturedReportDto` en `packages/contracts/src/index.ts` hoy. Este bloque lo crea de
cero (`FeaturedReportDto` + `FeaturedTag` + `FeaturedMomentDto`), no lo reutiliza.

### B2. Backend — endpoint de lectura (`history.controller.ts`)

Seguimos el patrón ya establecido en ese controller (records, trayectorias, crónicas —
todo de solo lectura):

```
GET /games/:id/season-reports              → SeasonReportDto[] (todas las ediciones, orden descendente por año)
GET /games/:id/season-reports/:year        → SeasonReportDto | 404
```

Implementación en `game.service.ts`: `loadState` → filtrar/mapear `state.seasonReports`
→ construir DTO. Sin transacción de escritura (solo lectura), igual que el resto de
`history.controller.ts`.

### B3. Backend — respuesta de `close-season`

`summaryFrom` (usado por los cuatro endpoints mutadores, incluido `close-season`) gana
un campo:

```ts
lastSeasonReport: state.seasonReports.length > 0
  ? state.seasonReports[state.seasonReports.length - 1]
  : null,
```

Mismo patrón que el `lastChronicle` que ya existe ahí — `SeasonReport` es un
superconjunto de `SeasonChronicle`, así que `lastChronicle` se puede dejar tal cual
(no se toca, principio "cero regresión" de §0) o marcarlo como redundante en un
comentario, a decidir en implementación; no se elimina en este ciclo.

### B4. Frontend — `api.ts`

```ts
seasonReports: (gameId: number) => Promise<SeasonReportDto[]>
seasonReport: (gameId: number, year: number) => Promise<SeasonReportDto>
```

Mismo wrapper tipado que el resto de `api.ts`, adjunta el JWT automáticamente.

### B5. Tests

- Backend: test de integración (si existen — verificar convención actual del repo en
  `apps/backend/test/` antes de asumir el formato) para `GET /games/:id/season-reports`
  devuelve 200 con array vacío en una partida recién creada, y no vacío tras un
  close-season con jugadores.
- `typecheck` + `lint` en los tres paquetes tocados (contracts, backend, frontend) — el
  criterio de aceptación estándar del repo para bloques de integración sin lógica nueva.

---

## C — Frontend: el Periódico

### C1. Qué reutiliza y qué es nuevo

De la investigación previa (confirmado leyendo el código, no asumido):

- **No existe ningún patrón de "revelación a pantalla completa"** en el frontend hoy.
  El único modal multi-paso es `FirstLoginModal.tsx` (onboarding, 3 diapositivas con
  puntos de paso) — sirve de referencia estructural (navegación por pasos, indicadores
  de progreso) pero su tono visual es plano, no "espectacular".
- **No existe confetti ni animación de celebración** en todo el frontend — se confirma
  que este es el primer momento verdaderamente dramático de la UI.
- El lenguaje visual ya establecido para "hitos"/"logros" (`HistoryPage.tsx`) usa:
  franja de acento izquierda de 3px coloreada por semántica, medallas circulares
  oro/plata/bronce (`#F59E0B`/`#9CA3AF`/`#D97706`), cifras en `var(--mantine-font-family-monospace)`
  (Geist Mono), fuente de display `Chakra Petch` para titulares grandes (la misma que
  usa `PageHero`), y las clases de animación ya globales `.page-enter`/`.stagger-item`
  (definidas en `global.css`, usadas en 18-20 archivos) para revelar contenido en
  cascada.
- **Paleta de secciones**, heredada 1:1 de cómo `HistoryPage.tsx` ya distingue bloques:
  oro `#F59E0B` (trofeos/campeón/portada), verde `#10B981` (economía/positivo), azul
  `#3B82F6` (mundo/rivales), púrpura `#8B5CF6` (récords), rojo `#EF4444` (confianza de
  junta a la baja/mandato fallido).

### C2. Estructura del componente

Nuevo `apps/frontend/src/components/SeasonNewspaper.tsx` — no es una `Modal` centrada
tipo `FirstLoginModal` (el contenido es demasiado denso para eso); es un overlay a
pantalla completa con scroll interno, estructurado como un periódico real de arriba
abajo:

1. **Cabecera / masthead.** Nombre de la federación del jugador como "cabecera de
   publicación" en `Chakra Petch` grande (mismo tratamiento que el `<h1>` de
   `PageHero`), con "Edición · Temporada {year}" como subtítulo, y un botón de cierre
   explícito (X / Esc / click fuera — cumple la decisión "fácil de saltar").
2. **Portada / titular principal.** `headline` en tipografía grande, con el campeón
   destacado (medalla dorada, puntos, franja de acento oro) — reemplaza visualmente
   (no funcionalmente: el código de `DashboardPage` sigue intacto) al panel ámbar actual
   de `SeasonChronicle`.
3. **Columna secundaria.** Revelación / decepción / índice de equilibrio — mismo trío
   que ya muestra el panel actual, con más aire y las franjas de acento verde/rojo ya
   usadas en `HistoryPage`.
4. **Barra de estado de la federación.** Prestigio (antes → después, con flecha y
   delta), confianza de la junta (antes → después + `reasons`), resultado del mandato —
   tres estadísticas tipo "stat tile" monospace, coherente con el resto del HUD.
5. **Sección "Deportes".** Premios de la temporada (`awards`, con nombre de jugador +
   equipo + valor), resultados de copas (`cupResults`, campeón/finalista/marcador si
   aplica), y el "Partido del año" (`featuredMatch`) con su cronología de goles minuto a
   minuto reutilizando el mismo formato narrativo que ya tiene `featured.ts` — esta es
   la pieza más "espectacular" del periódico, justifica una card propia con más
   protagonismo visual (quizás la única sección con fondo degradado, en línea con lo
   que `PageHero`/`ChampionBanner` de `CupsPage` ya hacen para momentos de trofeo).
6. **Sección "Récords".** Mayor goleada de la temporada (siempre, si hubo partidos) +
   aviso si además fue récord histórico absoluto (franja púrpura, coherente con
   `RecordBookPanel` de `HistoryPage`).
7. **Sección "Economía".** Los campos de `SeasonReportEconomy` como un pequeño estado
   de cuentas (ingresos, costes, prizes, neto, tesorería resultante) — tabla compacta
   monospace, verde si `net > 0`, rojo si `net < 0`. Transferencias notables debajo como
   lista corta.
8. **Sección "Mundo".** Un bloque por cada `SeasonReportRivalBrief` — reutiliza el
   patrón de card ya usado en `RivalChampionsPanel` (`HistoryPage.tsx`): franja azul,
   caja interior con degradado sutil para "campeón", lista de ascensos/descensos.
9. **"Breves".** Los `briefs` como una lista compacta al pie, con el mismo mapeo
   emoji+color por `FederationLogType` que ya usa `FederationTimelinePanel`
   (`FED_LOG_STYLE`) — cero diseño nuevo, reutilización directa.
10. **Animación de entrada.** Cada sección usa `.stagger-item` con `animationDelay`
    creciente (mismo mecanismo que ya usan las tablas de `HistoryPage`), para que el
    periódico se "revele" sección por sección al abrirse en vez de aparecer todo de
    golpe — es la única pieza de "espectáculo" nueva a nivel de motion, y ya existe como
    primitiva reutilizable, no hay que inventar keyframes.

### C3. Disparo

En `DashboardPage.tsx`, el `mClose` (`useMutationWithFeedback`) gana un `onSuccess` que
abre `SeasonNewspaper` con `data.lastSeasonReport` (ya viene en la respuesta de
`close-season`, cero round-trip extra — confirmado que hoy ese payload se descarta por
completo). El toast verde genérico ("Temporada cerrada") puede convivir con el
periódico o suprimirse en favor de él — decisión menor de pulido, no bloqueante.

### C4. Tests / verificación

- No hay convención de tests de componentes React en el repo (verificar en
  implementación; `CLAUDE.md` no menciona testing de frontend, solo engine). La
  verificación es manual: `pnpm dev`, cerrar una temporada real con jugadores y copas
  cargados, confirmar que el periódico se abre con datos reales y que cerrarlo no rompe
  el flujo normal del Dashboard.
- `typecheck` + `lint` en frontend, criterio estándar.

---

## D — Frontend: Historial → "Ediciones anteriores"

### D1. Diseño

Nueva pestaña en `HistoryPage.tsx` (`Tabs` ya usa `mi-liga` / `cronologia` /
`otras-federaciones` — se añade `ediciones`), listando `SeasonReportDto[]` por año
(orden descendente, año actual arriba) como una fila compacta por edición (año,
campeón, un dato llamativo — p. ej. "Partido del año: X vs Y"). Click abre el mismo
`SeasonNewspaper` de C, en modo lectura (mismo componente, misma prop `report`, sin
lógica condicional adicional — el componente ya es de solo lectura por diseño, no hay
"modo edición" que desactivar).

### D2. Tocado

- `apps/frontend/src/routes/HistoryPage.tsx` (nueva pestaña + query a
  `api.seasonReports(id)`).
- Ningún cambio en `SeasonNewspaper.tsx` más allá de asegurarse de que no asume que
  siempre se abre "en caliente" justo tras cerrar temporada (p. ej. sin animaciones que
  dependan de un estado transitorio que solo existe en el flujo de C3).

### D3. Tests

- Verificación manual: abrir Historial → Ediciones anteriores en una partida con 2+
  temporadas cerradas, confirmar que cada edición reabre con los datos correctos de su
  año (no el más reciente).

---

## Reglas transversales del ciclo

1. **RNG:** cero. Ningún paso de este ciclo tira un dado. Si en implementación aparece
   la tentación de "aleatorizar" algo (p. ej. variar el orden de las noticias breves),
   usar una clave determinista (orden de inserción, o `year`/`id`), nunca `Math.random()`
   — nota aparte: `generateHeadlines` (`headlines.ts`) ya usa `Math.random()` para
   barajar titulares rivales, una verruga preexistente. Si el periódico reutiliza esa
   función, tomar su **salida** tal cual (no volver a barajar) para no heredar la
   no-determinismo en algo que ahora sí se persiste.
2. **Migraciones:** v15 (bloque R1). Default en `migrations.ts`, nunca ad-hoc en
   `loadState`. `CURRENT_SCHEMA_VERSION` se bumpea en el mismo commit que introduce
   `seasonReports`.
3. **Golden master:** el bloque A no debe tocarlo. Es el criterio de aceptación — si el
   golden cambia, hay un bug (algún paso nuevo está mutando algo que no debería, o
   consumiendo `state.rng` por accidente).
4. **Checklist de acción nueva** (`CLAUDE.md`) aplica al endpoint de lectura de B2:
   engine → export → contracts → controller → service → `api.ts` → hook de datos →
   tests → migración. No aplica un flujo de escritura porque B2 es solo lectura.
5. **Ocultación de `potencial`:** ningún campo de `SeasonReport` expone el número —
   verificar explícitamente en R1.2 antes de cerrar el bloque (ya verificado en el
   diseño de este documento: no aparece en ningún tipo).
6. **Cada bloque = un PR**, R1+A pueden ir juntos en un único PR si se prefiere (son
   inseparables en la práctica, ver nota en el resumen de bloques). B, C, D por
   separado.
7. **Al cerrar el ciclo:** actualizar `CLAUDE.md` — nuevo tipo `SeasonReport` en "Key
   types", nuevos pasos del pipeline en la tabla de módulos (`season-pipeline.ts` ya
   está documentado; solo hace falta mencionar los dos steps nuevos si se considera
   relevante), nueva mecánica en "Key game mechanics", nuevo endpoint en la tabla de
   controllers de `history.controller.ts`.

## Riesgos principales

| Riesgo | Mitigación |
|---|---|
| El paso de ensamblado (305) se coloca antes de tiempo y lee `s.results`/`s.matchReports` ya vacíos | Test explícito en A5 que falla si el orden es incorrecto (copa forzada en 300 debe aparecer en `cupResults`); el propio diseño en dos pasos (265/305) existe para prevenir esto estructuralmente |
| El componente de C se vuelve "un dashboard más" en vez de sentirse como un periódico | C2 especifica un layout narrativo (portada → columnas → secciones), no una grilla de cards genérica; usar `Chakra Petch` a mayor tamaño que en cualquier otra pantalla para que el masthead se sienta distinto desde el primer vistazo |
| Migración v15 rompe partidas guardadas sin `seasonReports` | Default `[]`, sin backfill necesario (no hay datos que reconstruir) — el caso más simple de migración del historial reciente del proyecto |
| El periódico se siente como fricción en partidas con muchas temporadas por sesión | Ya resuelto por decisión del usuario: disparo automático pero fácil de saltar, sin pasos obligatorios |
| `notableTransfers`/`worldNews` filtran mal por año si `s.year` se lee en el momento equivocado | A2 fija `reportYear = s.year - 1` una sola vez en `ctx.meta`, y A3 lo reutiliza en vez de recalcularlo — un solo punto de verdad para el año del reporte dentro del pipeline |
