# Fase 17 — Poder y Política: el comisionado como protagonista

> **Documento de diseño exhaustivo.** Define la próxima fase de desarrollo completa:
> visión, mecánicas, tipos, estado, RNG, pipeline, migraciones, contratos, backend,
> frontend, tests y orden de implementación. Estado del motor al escribirlo:
> `CURRENT_SCHEMA_VERSION = 16`, pipeline de `closeSeason` con prioridades ocupadas
> 10–305, nueve streams de RNG independientes.

---

## 1. Diagnóstico de diseño

El juego simula muy bien **la liga**, pero el comisionado sigue siendo un
administrador, no un protagonista. Cuatro carencias estructurales:

| # | Carencia | Síntoma en partida |
|---|----------|--------------------|
| 1 | **No hay caras** | Los clubes son filas de una tabla; las federaciones rivales son números. Nadie recuerda al jugador ni reacciona a él como persona. |
| 2 | **No hay política** | Todas las decisiones son unilaterales: normas, reparto, expansión. El poder sin resistencia no es gameplay. |
| 3 | **No hay tentación** | Los impulsos son "hacer trampa" sin riesgo alguno. Un juego sobre poder necesita decisiones sucias con consecuencias. |
| 4 | **La temporada es hueca en el medio** | Entre pretemporada y cierre, el jugador mayormente pulsa "avanzar". Las decisiones densas viven en los extremos del bucle. |

La Fase 17 ataca las cuatro con siete sub-fases (17A–17G) diseñadas para
**reconvertir sistemas ya existentes** (arraigo, mandatos, demandas, normas,
confianza de la junta, narrativa) en un juego político, en lugar de añadir un
motor paralelo.

### 1.1 Principios no negociables (heredados)

- **Los equipos siguen siendo autónomos.** La asamblea vota cuestiones
  *institucionales* (normas, formato, reparto), nunca deportivas. El jugador jamás
  ficha por un club. Sin tácticas, alineaciones ni contratos de jugadores — nunca.
- **UI de solo datos.** Todo lo nuevo son tablas, listas, medidores y texto.
- **Simular rápido es sagrado.** Toda decisión intra-temporada nueva tiene
  auto-resolución determinista por defecto. El jugador que solo quiere avanzar
  jornadas no debe notar fricción nueva.
- **Historia append-only.** Todos los ledgers nuevos (propuestas, promesas, casos,
  votaciones) se escriben una vez y nunca se mutan destructivamente.
- **El engine es puro.** Toda función nueva toma y devuelve `GameState`. El backend
  sigue siendo la única cáscara imperativa.

### 1.2 Política de RNG (crítica)

Regla absoluta de esta fase: **ningún sistema nuevo añade draws a un stream
existente.** Se crean tres streams nuevos, siguiendo el precedente de
`mandatesRng` (seed del juego XOR constante):

| Stream nuevo | Constante XOR (sugerida) | Consumidores |
|--------------|--------------------------|--------------|
| `politicsRng` | `0x9E3779B9` | Asamblea (resolución de indecisos), humor de presidentes, pacing de la conspiración |
| `scandalRng` | `0x7F4A7C15` | Tirada de exposición de impulsos, spawn de casos de amaño, resultado de investigaciones, filtraciones |
| `deskRng` | `0x85EBCA6B` | Preguntas de prensa, eventos arbitrales del despacho |

Los rasgos de personajes (17A) se generan en **migración/creación** desde un RNG
derivado del seed (`seed XOR 0xC2B2AE35`), consumido una sola vez — no persiste
como stream.

### 1.3 Política de golden master

`golden.test.ts` compara `state.history` (los `SeasonRecord` del jugador) tras 6
temporadas con seed 777, **sin jugador humano actuando**. Impacto por sub-fase:

| Sub-fase | ¿Rompe golden? | Motivo |
|----------|----------------|--------|
| 17A Personajes | **No** | Solo añade datos narrativos; cero draws en streams existentes; rasgos sin efecto de simulación en v1 |
| 17B Opinión + Capital | **No** | La opinión se mueve por reglas deterministas sobre resultados ya simulados; el multiplicador económico solo altera `lastEconomy`/tesorería, no `history`. Verificar que `SeasonRecord` no serializa campos económicos afectados; si los serializa, re-baseline documentado |
| 17C Asamblea | **No** | Solo corre cuando el jugador propone algo. En una partida sin input, cero efecto |
| 17D Escándalos | **No** (con jugador pasivo) | Sin impulsos gastados no hay exposición; el detector de casos solo spawna con `scandalRng` y los casos sin resolver expiran sin tocar `history` |
| 17E Despacho | **No** | Auto-resolución determinista sin RNG (prime time = mayor strength combinada); prensa/árbitros solo con input del jugador |
| 17F Superliga | **No** (partida corta) | El trigger requiere arraigo crónicamente bajo, imposible en 6 temporadas sin abandono activo. Añadir aserción explícita al test |
| 17G Eras + pulidos | **⚠ Sí, uno** | Mandatos negociables generan 3 mandatos del `mandatesRng` en vez de 1: el stream es independiente pero el default "medio" puede diferir del mandato único actual. Re-baseline **intencional y revisado** al mergear 17G |

Cada sub-fase añade además una aserción a `invariants.test.ts` (ver §10).

---

## 2. Sub-fase 17A — Personajes: presidentes y comisionados rivales

### 2.1 Fantasía

El mundo tiene caras. Cada club tiene un presidente con nombre y carácter que
opina, vota, recuerda promesas y aparece en los titulares. Cada federación rival
tiene un comisionado con nombre y estilo — el némesis del jugador en el ranking
mundial.

### 2.2 Mecánica

**Presidentes de club** (todos los equipos de la federación del jugador):

| Rasgo | Sesgo político (se usa en 17C) | Sabor narrativo |
|-------|-------------------------------|-----------------|
| `leal` | +10 a intención de voto pro-comisionado | Defiende la federación en prensa |
| `ambicioso` | +15 en propuestas de expansión/copa nueva; −10 en subidas de tope salarial | Pide plazas europeas, presiona por crecer |
| `tradicionalista` | −20 en cambios de formato; +10 en normas de cantera | Titular contra "el circo moderno" |
| `mercenario` | Neutral salvo promesa activa (+25 con promesa vigente, −35 con promesa rota) | Solo habla de dinero |
| `institucional` | ±0, pero **siempre revela su intención de voto** | Voz de la casa, previsible |

- Se generan en `createGame` (juegos nuevos) o en la migración v17 (saves
  existentes), con nombres desde pools nuevos en `names.ts` y rasgo uniforme
  entre los 5.
- **Rotación:** en cada `closeSeason` hay una probabilidad del **8 %** por club
  (desde `politicsRng`) de relevo presidencial → nuevo nombre + rasgo, entrada en
  `federationLog` y titular. Un presidente nuevo **olvida promesas rotas**
  (resetea el rencor), lo que da al jugador una vía de escape natural.
- Los equipos que se adhieren a la federación traen presidente generado al
  hacerse efectiva la adhesión.

**Comisionados rivales** (uno por federación rival):

| Rasgo | Sabor narrativo (v1: solo narrativo) |
|-------|---------------------------------------|
| `agresivo` | Titulares desafiantes cuando roba o le robas un club |
| `conservador` | Declaraciones defensivas; celebra la estabilidad |
| `corrupto` | Rumores periódicos sobre su liga en las noticias del mundo |
| `visionario` | Anuncia "proyectos" cuando su coeficiente sube |
| `diplomático` | Propone colaboración cuando hay negociaciones inter-federación (6.3) |

> **Decisión de diseño explícita:** en v1 los rasgos de comisionados rivales son
> **solo narrativos** — no sesgan `rival-sim.ts`. Sesgar los pesos del rival sim
> alteraría `rivalRng` y el equilibrio validado del snowball. Queda definido como
> **17A.2 (opcional, post-fase)**: multiplicadores de agresividad de poach por
> rasgo, con re-baseline de golden explícito.

**Integración narrativa (el 80 % del valor de 17A):**

- `headlines.ts`: nuevos tipos de titular con cita del personaje
  (`presidente_declara`, `comisionado_rival_declara`). Plantillas por rasgo.
- `federation-log.ts`: los hechos existentes (robo de club, negociación aceptada,
  rescate, sanción) pasan a nombrar al presidente/comisionado implicado.
- `SeasonReport`: la sección de briefs rivales cita al comisionado rival del año.
- Frontend: la ficha del equipo (`TeamDetailPage`) muestra presidente + rasgo +
  historial de relación (promesas, votos, demandas); `FederationPage` de rivales
  muestra a su comisionado.

### 2.3 Tipos nuevos

```ts
export type PresidentTrait = 'leal' | 'ambicioso' | 'tradicionalista' | 'mercenario' | 'institucional';
export type RivalCommissionerTrait = 'agresivo' | 'conservador' | 'corrupto' | 'visionario' | 'diplomatico';

export interface ClubPresident {
  id: number;
  teamId: number;
  name: string;
  trait: PresidentTrait;
  sinceYear: number;
  // Rencor acumulado por promesas rotas / demandas ignoradas. 0-100.
  // Se consulta en la intención de voto (17C). Resetea con el relevo.
  grudge: number;
}

export interface RivalCommissioner {
  federationId: number;
  name: string;
  trait: RivalCommissionerTrait;
  sinceYear: number;
}
```

### 2.4 Estado, módulos y pipeline

- `GameState` añade: `presidents: ClubPresident[]`, `nextPresidentId: number`,
  `rivalCommissioners: RivalCommissioner[]`.
- Módulo nuevo `characters.ts`: `generatePresident`, `generateRivalCommissioner`,
  `presidentOf(state, teamId)`, `rotatePresidents` (step de cierre),
  `presidentQuote(trait, context)` / `rivalCommissionerQuote(...)` para headlines.
- `names.ts`: pools nuevos de nombres y apellidos de directivos (reutiliza el
  patrón `RngState`-in de los generadores existentes).
- **Step de `closeSeason`:** `rotatePresidents` en **prioridad 195** (hueco libre
  entre 190 sanciones/normas y 200; después de que el arraigo del cierre esté
  asentado, antes de la capa narrativa 2xx para que los titulares del año ya
  nombren al presidente saliente/entrante).

### 2.5 Migración (v17)

```ts
if (state.schemaVersion < 17) {
  const rng = createRng(state.seed ^ 0xC2B2AE35);
  state.presidents = state.teams
    .filter(inPlayerFederation)
    .map((t) => generatePresident(rng, t.id, state.year));
  state.rivalCommissioners = state.federations
    .filter((f) => !f.isPlayer)
    .map((f) => generateRivalCommissioner(rng, f.id, state.year));
  state.nextPresidentId = state.presidents.length + 1;
  state.politicsRng = createRng(state.seed ^ 0x9E3779B9);
}
```

### 2.6 Contratos, backend, frontend

- Contracts: `ClubPresidentSchema`, `RivalCommissionerSchema`; se anidan en las
  respuestas existentes de equipo y federación (sin endpoint nuevo obligatorio).
- Backend: `competition.controller.ts` enriquece `GET .../teams/:teamId` y la
  respuesta de federaciones. Cero endpoints nuevos.
- Frontend: bloque "Presidencia" en `TeamDetailPage`; bloque "Comisionado" en la
  vista de federación rival; citas en Dashboard/headlines.

### 2.7 Tests

- `characters.test.ts`: determinismo (mismo seed → mismos nombres/rasgos),
  rotación al 8 % sobre N cierres simulados, reset de `grudge` al rotar, todo
  equipo del jugador tiene exactamente un presidente vigente (también tras
  adhesiones).
- Invariante nueva: `presidents` cubre 1:1 los equipos de la federación del
  jugador; `grudge ∈ [0,100]`.

---

## 3. Sub-fase 17B — Opinión pública y capital político (los cimientos)

### 3.1 Fantasía

El comisionado responde ante **tres circunscripciones** que nunca pueden estar
contentas a la vez: la **Junta** (`boardConfidence`, ya existe), los **Clubes**
(el arraigo medio, ya existe) y la **Afición** (opinión pública, **nueva**).
Además acumula **capital político**: la moneda del favor que se gana cumpliendo
y se gasta forzando.

### 3.2 Opinión pública

`publicOpinion: number` (0–100, inicia en 50) + `opinionHistory` (paralelo a
`BoardConfidence.history`).

**Deltas al cierre de temporada** (deterministas, sin RNG, evaluados en un step
del pipeline):

| Fuente | Delta |
|--------|-------|
| Carrera de título apretada (≤3 pts entre 1º y 2º a falta de 3 jornadas) | +6 |
| Media de goles de la temporada ≥ 2.8 por partido | +2 |
| Final de copa disputada (cualquier copa del jugador finalizada) | +3 |
| Campeón nuevo (no repitió el del año anterior) | +4 |
| Escándalo filtrado (17D) | −15 |
| Amaño expuesto y sancionado (17D) | +8 |
| Demanda de club expirada sin respuesta esa temporada | −3 c/u (máx −9) |
| Regresión a la media | ±10 % de la distancia a 50 |

**Deltas intra-temporada:** respuestas de prensa (17E) y resolución de eventos
que ya existen (una `EventAction` populista podrá mover opinión — se etiquetan
en `events.ts` los 2-3 tipos de evento con componente público).

**Efectos:**

- **Multiplicador de ingresos de taquilla y merchandising:**
  `0.85 + (publicOpinion / 100) * 0.30` → rango 0.85–1.15. Se aplica dentro de
  `processEconomy` sobre las líneas de ingreso sensibles al público (no sobre
  patrocinios ni derechos ya firmados).
- **Arrastre sobre la junta:** cierre con opinión < 30 → `boardConfidence −5`;
  cierre con opinión ≥ 75 → `boardConfidence +3`.
- **Presión de éxodo:** opinión < 25 cuenta como agravante en el trigger de la
  conspiración (17F).

### 3.3 Capital político (PC)

`politicalCapital: number`, rango **0–12**, inicia en **3**.

| Se gana | PC |
|---------|----|
| Mandato de la junta cumplido | +1 |
| Promesa cumplida (17C) | +2 |
| Norma aprobada en asamblea y cumplida por todos al cierre | +1 |
| Amaño expuesto y sancionado (17D) | +2 |
| Era completada (17G) | +3 |

| Se gasta | PC |
|----------|----|
| Comprar un voto indeciso en la asamblea (17C) | 2 por club |
| Re-presentar una propuesta rechazada en la misma temporada (17C) | 4 |
| Acelerar una negociación de adhesión (revela un requisito extra ya) | 3 |
| Sobrevivir a la moción de censura (17G) | 6 |
| Enterrar un caso con garantías (rebaja la filtración, 17D) | 3 |

Sin decay pasivo: el PC solo se mueve por acciones. El cap de 12 fuerza a
gastarlo — acumular indefinidamente no es estrategia.

### 3.4 Estado, módulos, pipeline, migración

- `GameState`: `publicOpinion: number`, `opinionHistory: OpinionEntry[]`,
  `politicalCapital: number`, `politicsRng`, `scandalRng`, `deskRng` (los tres
  streams se siembran aquí aunque 17D/17E lleguen después — una sola migración
  de streams).
- Módulo nuevo `politics.ts`: `applyOpinionDelta(state, delta, reason)` (clampea
  y anota historia), `earnPC` / `spendPC` (clampean 0–12, loguean en
  `federationLog`), `closeSeasonOpinion` (step).
- **Steps de `closeSeason`:** `closeSeasonOpinion` en **prioridad 175** (después
  del procesado económico y de premios, antes de personajes 195 y narrativa
  2xx); el multiplicador de taquilla se integra **dentro** de `processEconomy`
  (sin step nuevo).
- Migración v17 (compartida con 17A): `publicOpinion = 50`,
  `politicalCapital = 3`, historias vacías, streams sembrados.

```ts
export interface OpinionEntry {
  year: number;
  value: number;
  reasons: string[]; // etiquetas legibles de los deltas aplicados
}
```

### 3.5 Contratos, backend, frontend

- Contracts: `publicOpinion`, `politicalCapital`, `opinionHistory` en la
  respuesta de estado del juego (`GET /games/:id`).
- Backend: sin endpoints nuevos (todo es estado leído + efectos en steps).
- Frontend: **tercer stat pill** en el HUD de `GameLayout` (Junta / Clubes /
  Afición, con flechas de tendencia); gráfico de opinión en `DashboardPage`
  junto al de confianza; contador de PC visible en el HUD (es la moneda que se
  consulta constantemente).

### 3.6 Tests

- `politics.test.ts`: clamps, cada regla de delta con escenarios sintéticos,
  multiplicador económico en los extremos (0.85 / 1.15), arrastre a la junta.
- Invariantes: `publicOpinion ∈ [0,100]`, `politicalCapital ∈ [0,12]`,
  `opinionHistory` append-only y con un entry por temporada cerrada.
- Golden: verificación explícita de que `SeasonRecord` no cambia (si el
  multiplicador tocase algún campo serializado en `history`, decidir
  re-baseline **antes** de mergear, no después).

---

## 4. Sub-fase 17C — La Asamblea de Clubes y el libro de promesas

### 4.1 Fantasía

La feature que más cambia el juego. Las decisiones estructurales dejan de ser
unilaterales: se **proponen**, se hace **lobby** club a club, y se **votan**. El
arraigo deja de ser un número pasivo y se convierte en el mapa político del
jugador. Las promesas son el lubricante — y la deuda.

### 4.2 Qué se vota y qué no

| Requiere votación | Mayoría | Sigue siendo unilateral |
|---|---|---|
| Crear una norma nueva | Simple (>50 %) | Sanciones por incumplimiento de normas vigentes |
| Cambiar la política de reparto de premios/derechos | Simple | Impulsos, revisiones VAR |
| Crear una copa recurrente nueva | Simple | Copas no recurrentes (torneo puntual) |
| Derogar una norma vigente | Simple | Acciones de comisionado existentes (`emergency_meeting`, etc.) |
| Expandir/abrir una división | **2/3** | Firmar contratos comerciales de la federación |
| Cambiar el formato de liga (`ida`/`ida_vuelta`) | **2/3** | Resolver demandas de clubes |
| Admisión acelerada de una adhesión (recorta 1 año el delay) | **2/3** | Negociaciones de adhesión en sí |

- **Censo:** un club, un voto. Votan todos los clubes de las divisiones del
  jugador (todas las divisiones, no solo primera — los chicos importan, ese es
  el punto).
- **Calendario:** las propuestas se presentan en cualquier momento; la votación
  se resuelve al **avanzar la siguiente jornada** (o inmediatamente en
  pretemporada). Máximo **2 propuestas simultáneas** en tramitación.
- **Cooldown:** una propuesta rechazada no puede re-presentarse hasta la
  temporada siguiente, salvo pagando 4 PC.

### 4.3 Intención de voto

Cada club computa un **score** determinista + ruido acotado:

```
score = interésBase(tipoPropuesta, club)          // −40 … +40, tabla por tipo
      + arraigoMod                                 // arraigo ≥70 → +15; ≤35 → −15
      + rasgoPresidente                            // tabla de 17A
      + memoriaPromesas                            // cumplida <2 años: +20; rota: −30
      − grudge / 4                                 // rencor del presidente (0..−25)
```

`interésBase` por tipo (ejemplos de la tabla completa a calibrar):

- *Reparto más igualitario:* clubes en la mitad inferior de strength de su
  división +30; top 25 % −35.
- *Norma `tope_salarial`:* clubes con masa salarial sobre la mediana −25; bajo
  la mediana +15.
- *Expansión de división:* clubes de segunda +25 (más plazas de ascenso);
  `tradicionalista` aplica su −20 encima.
- *Copa nueva:* +10 general; +25 si el club está en la lista de participantes.

**Resolución:** `score > +10` → a favor; `< −10` → en contra; intermedio →
**indeciso**, y los indecisos se resuelven en el momento del voto con
`politicsRng` sesgado por el score (`p(favor) = 0.5 + score/40`).

**Lobby (la fase divertida):** entre la propuesta y el voto, el jugador ve el
recuento previsto — pero la intención de cada club solo se **revela** según el
presidente: `institucional` siempre; `leal`/`tradicionalista`/`ambicioso` se
revelan gastando 0 PC (una consulta, acción gratuita limitada a 3 por
propuesta); `mercenario` nunca revela (aparece siempre "indeciso"). Sobre un
indeciso o contrario blando (score > −20) el jugador puede:

1. **Comprar el voto** — 2 PC → pasa a favor garantizado.
2. **Prometer** — crea una `Pledge` (ver 4.4) → +25 al score de este voto y
   entra en el libro de promesas.

### 4.4 El libro de promesas

```ts
export type PledgeKind =
  | 'plaza_copa'        // el club entra en la próxima copa recurrente creada/editada
  | 'mejora_reparto'    // la próxima revisión del reparto no baja su cuota
  | 'exencion_norma'    // 1 temporada sin sanción por una norma concreta
  | 'rescate_futuro';   // ayuda garantizada de cuantía fijada si la pide

export interface Pledge {
  id: number;
  teamId: number;
  kind: PledgeKind;
  refId?: number;          // normId / cupId según kind
  amount?: number;         // para rescate_futuro
  madeYear: number;
  deadlineYear: number;    // madeYear + 2
  status: 'pendiente' | 'cumplida' | 'rota';
}
```

- **Verificación automática** en `closeSeason`: un step comprueba cada promesa
  pendiente contra el estado. Cumplida → `+2 PC`, `arraigo +6` del club,
  entrada en `federationLog`. Vencida sin cumplir → `rota`: `arraigo −10`,
  `grudge +25` del presidente, titular, `−1 PC` (mín 0).
- Las promesas rotas **persisten** en el ledger y pesan en futuros votos hasta
  que el presidente rote (17A) — el rencor es del hombre, no de la institución.

### 4.5 Tipos y estado

```ts
export type ProposalKind =
  | 'norma_nueva' | 'derogar_norma' | 'cambio_reparto' | 'copa_recurrente'
  | 'expansion_division' | 'cambio_formato' | 'admision_acelerada';

export type ProposalStatus = 'en_tramite' | 'aprobada' | 'rechazada';

export interface AssemblyVote {
  teamId: number;
  intention: 'favor' | 'contra' | 'indeciso'; // pre-voto (lo que el jugador ve)
  revealed: boolean;
  bought: boolean;                            // comprado con PC
  pledgeId?: number;                          // prometido
  final?: 'favor' | 'contra';                 // resultado del día del voto
}

export interface AssemblyProposal {
  id: number;
  kind: ProposalKind;
  payload: unknown;            // p.ej. la Norm a crear, la EconomyPolicy nueva…
  year: number;
  proposedAtMatchday: number;
  majority: 'simple' | 'dos_tercios';
  votes: AssemblyVote[];
  status: ProposalStatus;
  resolvedAtMatchday?: number;
}
```

`GameState`: `proposals: AssemblyProposal[]`, `nextProposalId`,
`pledges: Pledge[]`, `nextPledgeId`.

### 4.6 Arquitectura engine (clave para no romper nada)

Las funciones puras existentes (`createNorm`, `setEconomyPolicy`, `createCup`,
expansión…) **no cambian de firma ni de comportamiento** — los tests unitarios
actuales siguen pasando. La asamblea es una **capa envolvente**:

- `assembly.ts` (módulo nuevo): `proposeMeasure`, `computeIntentions`,
  `revealIntention`, `buyVote`, `pledgeForVote`, `resolveProposal` (llamada
  desde `advanceMatchday` para propuestas vencidas), y `applyApprovedProposal`
  que despacha al módulo correspondiente (`norms.ts`, `economy.ts`, `cups.ts`,
  `structure.ts`).
- **El backend es quien fuerza la vía asamblearia:** los endpoints unilaterales
  actuales de esas siete acciones pasan a responder `409` con
  `requiresAssembly: true`, y `governance/economy/competition` ganan la vía
  `POST .../proposals`. El engine sigue permisivo (precedente exacto de
  `preseason.ts`).
- `pledges.ts` (módulo nuevo): creación, verificación (`verifyPledges`, step de
  cierre), y los efectos de cumplimiento/ruptura.

**Steps de `closeSeason`:** `verifyPledges` en **prioridad 165** (después de
premios/economía — muchas promesas se verifican contra reparto y copas — y
antes de la opinión 175, que puede leer promesas rotas del año);
`expireProposals` en **prioridad 167** (toda propuesta `en_tramite` al cierre se
resuelve o expira — nada cruza temporadas).

### 4.7 Migración (v18)

`proposals = []`, `nextProposalId = 1`, `pledges = []`, `nextPledgeId = 1`.
Sin retro-efectos: las normas/copas creadas antes de v18 son legítimas.

### 4.8 Contratos y backend

Contracts: `ProposeMeasureRequest` (discriminated union por `kind` con su
payload Zod), `RevealIntentionRequest`, `BuyVoteRequest`, `PledgeForVoteRequest`,
`AssemblyProposalSchema`, `PledgeSchema`.

Controller nuevo `assembly.controller.ts`:

| Ruta | Acción |
|------|--------|
| `GET /games/:id/assembly` | Propuestas + censo + intenciones visibles + libro de promesas |
| `POST /games/:id/assembly/proposals` | Presentar propuesta (valida cap de 2, cooldown) |
| `POST /games/:id/assembly/proposals/:pid/reveal` | Consultar intención de un club (máx 3) |
| `POST /games/:id/assembly/proposals/:pid/buy-vote` | Comprar indeciso (2 PC) |
| `POST /games/:id/assembly/proposals/:pid/pledge` | Prometer a cambio del voto |
| `POST /games/:id/assembly/proposals/:pid/withdraw` | Retirar propuesta antes del voto |

La resolución del voto no tiene endpoint: ocurre dentro de `advance` (patrón
transaccional estándar `loadState → engine → saveState`).

### 4.9 Frontend

Página nueva `AssemblyPage` ("Asamblea"): recuento en vivo (a favor / en contra
/ indecisos / ocultos), lista de clubes con presidente + rasgo + palanca de
lobby por fila, historial de votaciones pasadas, y pestaña "Libro de promesas"
(pendientes con deadline, cumplidas, rotas). Badge de urgencia en el sidebar
cuando hay votación resolviéndose la próxima jornada. `MailboxPage` recibe
mensajes de resultado de votación (categoría nueva).

### 4.10 Tests

- `assembly.test.ts`: fórmula de score por cada `ProposalKind` con clubes
  sintéticos; mayorías simple/2-3 con censos pares e impares; compra y promesa
  alteran el resultado; cooldown; cap de propuestas; `applyApprovedProposal`
  despacha idéntico a la llamada directa del módulo (test de equivalencia).
- `pledges.test.ts`: verificación de cada `PledgeKind` cumplido y roto; efectos
  sobre arraigo/PC/grudge; append-only.
- Invariantes: `votes.length` = censo del momento de la propuesta; una
  propuesta `aprobada` de norma implica que la norma existe; PC nunca negativo
  tras cualquier secuencia de lobby.

---

## 5. Sub-fase 17D — Escándalos e integridad (la tentación)

### 5.1 Fantasía

El poder mancha. Los impulsos dejan huella y los resultados sospechosos abren
casos que el comisionado puede investigar — o enterrar. No hay respuesta
correcta: exponer duele hoy y paga mañana; enterrar es gratis hasta que deja de
serlo.

### 5.2 La huella de los impulsos

`exposureRisk: number` (0–95, oculto en el HUD pero **visible con señales
cualitativas**: el asesor del mailbox avisa con "hay murmullos" a partir de 30 y
"la prensa hace preguntas" a partir de 55).

- Impulso gastado: **+8**. Impulso repetido sobre el mismo equipo en la misma
  temporada: **+4 extra** por repetición.
- `call_review` no suma (es una acción pública; ya cuesta −1 prestigio).
- Decay al cierre: **−6** (floor 0). El tiempo cura — si paras.
- **Tirada de escándalo** al cierre (step, `scandalRng`): si
  `roll(0..100) < exposureRisk` → **escándalo de amaño institucional**:
  prestigio −3, `boardConfidence −10`, `publicOpinion −15`, `exposureRisk = 0`,
  titular + mailbox + `federationLog`, y el escándalo queda en el ledger de
  casos como `filtrado`.

Con estos números: 1–2 impulsos/temporada es riesgo bajo sostenible (~10 % al
cierre); 4+ impulsos concentrados es ruleta rusa (~35–45 %). El impulso pasa de
botón gratis a pacto con el diablo — que es lo que temáticamente siempre fue.

### 5.3 Casos de amaño (investigaciones)

**Detector determinista** (sin RNG en la detección; `scandalRng` solo decide
cuáles de los candidatos cuajan, máx **2 casos/temporada**):

Un resultado es *sospechoso* si en las **últimas 5 jornadas** un equipo **sin
nada en juego** (sin opción matemática de ascenso/descenso/título) pierde por
**≥3 goles** contra un equipo **con algo en juego**, o si un colista vence
**0-3+ fuera** al líder. Se computa sobre `matchReports` + clasificación, todo
ya en estado.

```ts
export type CaseStatus = 'abierto' | 'investigando' | 'confirmado'
  | 'archivado' | 'enterrado' | 'filtrado' | 'sin_pruebas';

export interface IntegrityCase {
  id: number;
  year: number;
  matchday: number;
  homeId: number;
  awayId: number;
  suspicion: string;            // texto del detector
  status: CaseStatus;
  investigationEndsMatchday?: number;
  leakRisk: number;             // 0-100, solo crece en enterrados
  resolution?: string;
}
```

**Opciones del comisionado** (vía mailbox, con deadline de 3 jornadas):

1. **Investigar** — coste económico (constante `INVESTIGATION_COST`, a calibrar
   ~al 30 % de un premio de media tabla), dura 3 jornadas. Resultado
   (`scandalRng`): **40 % amaño confirmado**, 60 % `sin_pruebas` (cierre limpio,
   −1 de opinión por el ruido).
2. **Archivar** — gratis, `exposureRisk +6` (la prensa nota la desidia).
3. **Enterrar** — solo disponible si hay indicios fuertes (el detector marca
   `strong: boolean` cuando el margen es ≥5 o hay reincidencia del club).
   `leakRisk` inicial 20, **+15 por temporada**; tirada de filtración en cada
   cierre. Filtrado → los efectos del escándalo (§5.2) **más** `−20` de opinión
   (encubrimiento) y `grudge +30` de los presidentes no implicados. Gastar
   **3 PC** al enterrar rebaja el `leakRisk` inicial a 10.

**Amaño confirmado** abre la segunda decisión, la de verdad:

- **Sancionar** — el club implicado recibe sanción dura (deducción de puntos la
  temporada siguiente vía `sanctions` existente + multa): `publicOpinion +8`,
  `+2 PC`, prestigio +1 (integridad)… y `arraigo −15` del club sancionado más
  `grudge +40` de su presidente. Si ese club era tu aliado en la asamblea, lo
  acabas de perder.
- **Perdonar discretamente** — sin castigo: el caso pasa a `enterrado` con
  `leakRisk 35`. El club te debe una: `arraigo +8`, y su presidente vota
  contigo (+25 permanente mientras no rote)… si no se filtra.

### 5.4 Estado, módulos, pipeline, migración

- `GameState`: `exposureRisk: number`, `integrityCases: IntegrityCase[]`,
  `nextCaseId: number` (el stream `scandalRng` ya se sembró en v17).
- Módulo nuevo `integrity.ts`: detector, spawn (llamado desde
  `advanceMatchday`, gated por `scandalRng` y el cap de 2/temporada),
  `startInvestigation` / `resolveInvestigation` / `buryCase` / `archiveCase` /
  `sanctionFixing` / `pardonFixing`, y dos steps de cierre:
  `rollExposure` (**prioridad 172**, antes de que la opinión 175 lea el
  resultado) y `rollLeaks` + decay (**misma 172**, un solo step
  `closeSeasonIntegrity`).
- Los impulsos suman exposición en el propio `engine.ts` donde se aplican
  (`pendingImpulses` → una línea en el punto de gasto).
- Migración v19: `exposureRisk = 0`, `integrityCases = []`, `nextCaseId = 1`.

### 5.5 Contratos, backend, frontend

- Contracts: `IntegrityCaseSchema`, `ResolveCaseRequest`
  (`{ action: 'investigar'|'archivar'|'enterrar'|'sancionar'|'perdonar', spendPC?: boolean }`).
- Backend: en `governance.controller.ts` (es materia de gobernanza):
  `GET /games/:id/integrity` (casos + señales cualitativas de exposición, nunca
  el número exacto) y `POST /games/:id/integrity/cases/:caseId/resolve`.
- Frontend: pestaña "Integridad" dentro de `NormsPage` (que pasa a llamarse
  "Gobernanza" en la navegación): lista de casos con su estado, y el indicador
  cualitativo de rumores. Los casos abiertos llegan también por mailbox con
  `actionKind` nuevo.

### 5.6 Tests

- `integrity.test.ts`: detector con reports sintéticos (positivos y falsos
  positivos: goleada entre dos equipos sin nada en juego NO es caso); cap
  2/temporada; matriz completa de resoluciones y sus efectos; acumulación y
  decay de exposición; tirada de filtración con seeds fijados; escándalo resetea
  exposición.
- Invariantes: `exposureRisk ∈ [0,95]`; ledger de casos append-only en status
  terminal; partida sin impulsos gastados nunca produce escándalo de exposición
  (aserción golden-guard).

---

## 6. Sub-fase 17E — El despacho semanal (densificar la temporada)

### 6.1 Fantasía

Cada jornada, el comisionado despacha: elige el partido televisado, asigna
árbitro al partido caliente, contesta a la prensa. Diez segundos de decisión
que hacen que avanzar jornada nunca sea solo un clic — **sin frenar a quien
quiere simular rápido** (todo auto-resoluble).

### 6.2 Las tres bandejas

**1. Prime time (cada jornada, primera división):** elegir 1 partido.

- El elegido concentra el bonus TV de la jornada: `+PRIMETIME_BONUS` a los
  ingresos de derechos del cierre (acumulador estacional, se liquida en
  `processEconomy`).
- Un club **nunca elegido en 8+ jornadas consecutivas** pierde 1 de arraigo
  (máx −3/temporada por club). Elegir siempre al mismo grande tiene coste.
- **Auto-resolución:** el partido con mayor suma de strength (determinista,
  cero RNG). El jugador pasivo obtiene un default razonable y ningún prompt.

**2. Árbitros (solo partidos calientes):** pool de **8 árbitros** con nombre
(desde `names.ts`) y rasgo `estricto | permisivo | estrella | novato`. Partido
caliente = derbi (`Rivalry` existente) o duelo directo por título/descenso en
las últimas 5 jornadas.

- `estrella`: los eventos de polémica ligados a ese partido tienen **−50 %** de
  probabilidad; solo puede pitar **1 de cada 3** jornadas (fatiga).
- `novato`: **+50 %** de probabilidad de polémica, pero cada partido caliente
  que pita limpio lo acerca a promocionar a `estricto` (progresión visible).
- **Los árbitros jamás tocan el resultado del partido** — `simulateMatch` no se
  entera de que existen. Solo modulan el spawn de eventos *arbitrales* nuevos,
  generados desde `deskRng` (nunca desde `eventsRng`).
- Auto-resolución: rotación round-robin de los no-novatos.

**3. La pregunta de prensa (a veces):** tras una jornada con titular fuerte
(polémica, goleada al líder, racha rota), `deskRng` decide (p≈0.35, máx 1 por
jornada) si hay pregunta. Tres respuestas fijas por plantilla:

| Tono | Efecto |
|------|--------|
| Institucional | `boardConfidence +2`, `publicOpinion −1` |
| Populista | `publicOpinion +3`, `boardConfidence −2` |
| Evasiva | Nada… pero 3 evasivas seguidas → `publicOpinion −3` |

Auto-resolución: evasiva (con su riesgo acumulado — el silencio también es una
política).

### 6.3 Flujo backend/UX (el punto delicado)

El despacho **no bloquea** `advance`. `GET /games/:id/desk` devuelve las
bandejas de la jornada próxima; el jugador puede fijar decisiones con
`POST /games/:id/desk` **antes** de avanzar; `advance` aplica lo fijado y
auto-resuelve lo demás dentro de la misma transacción. Un jugador que nunca
abre el despacho juega exactamente igual que hoy.

### 6.4 Tipos, estado, migración

```ts
export type RefereeTrait = 'estricto' | 'permisivo' | 'estrella' | 'novato';

export interface Referee {
  id: number;
  name: string;
  trait: RefereeTrait;
  hotMatchesClean: number;   // progresión novato → estricto (a 4)
  lastHotMatchday: number;   // fatiga de la estrella
}

export interface DeskDecisions {
  matchday: number;
  primetimeFixtureIdx?: number;
  refereeAssignments: Array<{ fixtureIdx: number; refereeId: number }>;
  pressAnswer?: 'institucional' | 'populista' | 'evasiva';
}
```

`GameState`: `referees: Referee[]`, `nextRefereeId`, `deskPending: DeskDecisions | null`,
`primetimeDrought: Record<number, number>` (teamId → jornadas sin elegir),
`primetimeSeasonBonus: number`, `consecutiveEvasions: number`.

Módulo nuevo `desk.ts` con `deskInbox(state)` (derivación pura de las bandejas),
`setDeskDecisions`, `applyDesk(state)` (llamado al inicio de `advanceMatchday`).
Migración v20: genera los 8 árbitros (`seed XOR 0x27D4EB2F`, un solo uso),
inicializa contadores a cero.

### 6.5 Contratos, backend, frontend

- Contracts: `DeskInboxSchema`, `SetDeskDecisionsRequest`.
- Backend: controller nuevo `desk.controller.ts` (`GET /games/:id/desk`,
  `POST /games/:id/desk`).
- Frontend: **panel embebido en `DashboardPage`** (no página nueva): tarjeta
  "El despacho" sobre el botón de avanzar, con las 1–3 decisiones de la jornada
  como selects compactos. Los árbitros ganan una mini-tabla en la pestaña de
  gobernanza.

### 6.6 Tests

- `desk.test.ts`: auto-resolución determinista (mismo estado → misma elección);
  sequía de prime time y su clamp; fatiga y progresión de árbitros; contador de
  evasivas; `applyDesk` sin decisiones = comportamiento idéntico a no tener
  despacho (test de equivalencia golden-guard).
- Invariantes: `primetimeDrought` solo contiene equipos de primera del jugador;
  bonus estacional se resetea al cierre.

---

## 7. Sub-fase 17F — La conspiración de la Superliga (late-game)

### 7.1 Fantasía

El espejo oscuro de la adhesión: cuando descuidas a tus grandes, **conspiran
para irse**. Es el generador de crisis del late-game — la meseta del mid-game se
convierte en tensión.

### 7.2 Máquina de estados

```ts
export type ConspiracyPhase = 'rumor' | 'organizada' | 'ultimatum' | 'desactivada' | 'consumada';

export interface Conspiracy {
  phase: ConspiracyPhase;
  memberTeamIds: number[];
  ringleaderTeamId: number;      // el de menor arraigo
  startedYear: number;
  demands: ConspiracyDemand[];   // se fijan al llegar a 'ultimatum'
  deadlineYear: number;
}

export interface ConspiracyDemand {
  kind: 'mejora_reparto_grandes' | 'plazas_copa_garantizadas' | 'derogar_norma' | 'inversion_estadios';
  refId?: number;
  met: boolean;
}
```

**Trigger** (evaluado en un step de cierre, solo si no hay conspiración
activa): ≥3 clubes del jugador con `arraigo < 40` **y** strength en el top 25 %
de la federación. Agravantes que aceleran una fase la transición:
`publicOpinion < 25`, o una promesa rota este año a uno de los miembros.
`politicsRng` decide el arranque (p = 0.5 si se cumplen condiciones — no es
automático, es una amenaza que acecha).

**Fases (una transición por cierre de temporada):**

1. **`rumor`** — señales deliberadamente ambiguas: entrada críptica en
   `federationLog`, mensaje del asesor en mailbox ("cenas discretas entre
   presidentes"). El jugador que lee, se entera; el que no, no.
2. **`organizada`** — los miembros se conocen (mailbox los nombra). Ventana de
   apaciguamiento: subir el arraigo de un miembro a ≥55 lo saca de la
   conspiración; si quedan <3 miembros → `desactivada`.
3. **`ultimatum`** — 2–3 demandas concretas y públicas (titular). Deadline: el
   siguiente cierre. Cumplir **≥2** → `desactivada` (+4 de opinión, "el
   comisionado salvó la liga"). Las demandas se implementan con los sistemas
   existentes (asamblea para el reparto, promesas, demandas de club).
4. **`consumada`** — los miembros se van: cada uno a la federación rival de
   mayor coeficiente dispuesta (reutiliza la maquinaria de re-asociación
   existente: nada se borra). Si se iban a ir **≥ la mitad de la primera
   división** → `GameOverReason` nuevo `'escision'`. Si es menos, la liga
   sobrevive amputada: prestigio −6, opinión −10, confianza −15.

**Contra-juego adicional — romper al cabecilla:** una vez en `organizada`, el
jugador puede **expulsar/sancionar duramente al ringleader** (acción de
gobernanza): la conspiración pierde a su organizador y se desactiva, pero:
prestigio −2, opinión −8 (medida autoritaria), el club expulsado se va ya, y los
demás miembros quedan con `grudge +20`. Amputación controlada.

### 7.3 Estado, pipeline, migración

- `GameState`: `conspiracy: Conspiracy | null`,
  `conspiracyHistory: Conspiracy[]` (las terminadas, append-only).
- Módulo nuevo `conspiracy.ts`; step único `advanceConspiracy` en
  **prioridad 168** (después de verificar promesas 165/167 — las promesas rotas
  del año alimentan el trigger — y antes de la opinión 175 y la tirada de
  confianza, que leen sus consecuencias).
- Migración v21: `conspiracy = null`, `conspiracyHistory = []`. `GameOverReason`
  suma `'escision'`.

### 7.4 Contratos, backend, frontend

- Contracts: `ConspiracySchema`; `ResolveConspiracyActionRequest`
  (`{ action: 'expulsar_cabecilla' }` — el apaciguamiento no tiene endpoint
  propio: se hace jugando los sistemas existentes, que es el punto).
- Backend: `governance.controller.ts` expone el estado (solo desde fase
  `organizada`) y la acción de expulsión.
- Frontend: banner de crisis en `DashboardPage` y `FederationPage` desde
  `organizada`; las demandas del ultimátum como checklist con estado. En
  `rumor` no hay UI dedicada — solo las señales narrativas (decisión de diseño:
  premiar al que lee).

### 7.5 Tests

- `conspiracy.test.ts`: trigger exacto (3 clubes, umbrales); apaciguamiento por
  arraigo; expulsión del cabecilla; consumación con re-asociación verificada
  (los equipos existen en la federación destino); `'escision'` con ≥50 % de
  primera; nunca dos conspiraciones simultáneas.
- Invariante: en 6 temporadas con seed 777 y jugador pasivo, `conspiracy`
  permanece `null` (guard de golden).

---

## 8. Sub-fase 17G — Legado, eras y pulido de mecánicas

### 8.1 Eras y legado (la condición de victoria que falta)

Hoy solo existen condiciones de derrota. Las **eras** son la escalera de largo
plazo:

| Era | Hitos (todos) |
|-----|---------------|
| I. **Fundacional** (inicio) | 14 equipos · 2 divisiones activas · primer contrato comercial ≥ umbral grande |
| II. **Consolidación** | Coeficiente top 5 · copa recurrente con ≥3 ediciones · 16 equipos |
| III. **Reconocimiento** | Coeficiente top 3 · robar un club a una federación top-3 · opinión ≥65 en dos cierres seguidos |
| IV. **Élite mundial** | Coeficiente nº1 · 20+ equipos · ganar la copa inter-ligas |

- Evaluación en step de cierre (**prioridad 262**, tras coeficientes y récords,
  antes del `SeasonReport`, que dedica portada a la era completada).
- Completar una era: **edición especial del periódico** (flag en
  `SeasonReport`), `impulsesPerSeason +1` permanente, `boardConfidence +15`,
  `+3 PC`, entrada solemne en `federationLog`.
- `state.era` + `eraHistory` (año de cada completada). La migración v22 evalúa
  retroactivamente los hitos ya cumplidos para no castigar saves veteranos.
- No hay "fin de partida" al completar la IV: hay un salón de la fama del
  comisionado (`HistoryPage`) y el sandbox continúa. La era es narrativa de
  cumbre, no pantalla de créditos.

### 8.2 Moción de censura (la derrota que se ve venir y se pelea)

En el step de confianza del cierre, si `boardConfidence < 25` **antes** de
disparar la destitución:

1. Se abre el evento **moción de censura** (mailbox, bloqueante del cierre
   siguiente — mismo mecanismo que los eventos pendientes actuales).
2. Supervivencia: **gastar 6 PC** → `boardConfidence = 40`; o **defensa por
   méritos** (mandato cumplido este año o era completada) → gratis,
   `boardConfidence = 35`.
3. Sin PC ni méritos → `gameOver 'destitucion'` como hoy.
4. **Máximo una supervivencia por era** (`censureUsedInEra: boolean`) — la
   segunda moción dentro de la misma era es definitiva. La derrota debe poder
   pelearse, no farmearse.

### 8.3 Mandatos negociables

`startSeason` genera **3 mandatos** (fácil / medio / difícil, mismo
`mandatesRng`, dificultad = distancia del target al estado actual). El jugador
elige en pretemporada (item no bloqueante del checklist; default: medio).

| Elección | Al cumplir | Al fallar |
|----------|-----------|-----------|
| Fácil | `+2` confianza | `−12` confianza (la junta no perdona fallar lo fácil) |
| Medio | `+5` confianza, `+1 PC` | `−8` confianza |
| Difícil | `+9` confianza, `+1 PC`, `+1` impulso esa temporada | `−5` confianza (lo intentaste) |

> Este es el cambio que fuerza el **re-baseline del golden** de la fase (ver
> §1.3): draws extra de `mandatesRng` y default distinto del mandato único
> actual. Se mergea en PR propio con el diff del snapshot revisado.

### 8.4 Pulidos menores (cada uno, un PR pequeño)

- **Demandas con contraoferta:** `resolveDemand` gana la opción
  `'contraoferta'`: 50 % de la cuantía + una condición (el voto favorable del
  club en la propuesta activa, si la hay). Satisface a medias: `arraigo +3` (vs
  +8 completo), sin erosión.
- **Negociaciones con concesiones:** en `gathering_requirements`, gastar 3 PC
  revela el siguiente requisito inmediatamente (encaja con el ciclo de 1–3
  años sin romperlo: acelera, no elimina).
- **Normas con oposición real:** al aprobarse una norma en asamblea, los
  clubes que votaron en contra arrancan con `violationHistory` mental: +20 % de
  probabilidad de incumplirla el primer año (flag en el breach-check, sin RNG
  nuevo: determinista sobre el voto registrado).
- **Renombrar navegación:** "Normas" → "Gobernanza" (normas + sanciones +
  integridad); el mailbox agrupa por circunscripción (Junta / Clubes / Afición /
  Casos).

### 8.5 Estado y migración (v22)

`era: 1|2|3|4`, `eraHistory: Array<{ era: number; completedYear: number }>`,
`censureUsedInEra: boolean`, `mandateOptions: BoardMandate[]` (las 3 del año),
`mandateChosen: boolean`. Módulos: `eras.ts` nuevo; `board.ts` gana la moción;
`engine.ts` cambia la generación de mandatos.

---

## 9. Resumen transversal de implementación

### 9.1 Nuevos campos de `GameState` (consolidado)

```ts
// 17A (v17)
presidents: ClubPresident[]; nextPresidentId: number;
rivalCommissioners: RivalCommissioner[];
// 17B (v17)
publicOpinion: number; opinionHistory: OpinionEntry[];
politicalCapital: number;
politicsRng: RngState; scandalRng: RngState; deskRng: RngState;
// 17C (v18)
proposals: AssemblyProposal[]; nextProposalId: number;
pledges: Pledge[]; nextPledgeId: number;
// 17D (v19)
exposureRisk: number; integrityCases: IntegrityCase[]; nextCaseId: number;
// 17E (v20)
referees: Referee[]; nextRefereeId: number;
deskPending: DeskDecisions | null;
primetimeDrought: Record<number, number>; primetimeSeasonBonus: number;
consecutiveEvasions: number;
// 17F (v21)
conspiracy: Conspiracy | null; conspiracyHistory: Conspiracy[];
// 17G (v22)
era: number; eraHistory: Array<{ era: number; completedYear: number }>;
censureUsedInEra: boolean;
mandateOptions: BoardMandate[]; mandateChosen: boolean;
```

### 9.2 Mapa del pipeline de `closeSeason` (prioridades nuevas)

| Prioridad | Step | Sub-fase |
|-----------|------|----------|
| 165 | `verifyPledges` | 17C |
| 167 | `expireProposals` | 17C |
| 168 | `advanceConspiracy` | 17F |
| 172 | `closeSeasonIntegrity` (exposición + filtraciones + decay) | 17D |
| 175 | `closeSeasonOpinion` | 17B |
| 195 | `rotatePresidents` | 17A |
| 262 | `evaluateEra` | 17G |

Huecos verificados contra las prioridades ocupadas hoy (10–305). La moción de
censura vive dentro del step de confianza existente, no añade prioridad. Orden
razonado: promesas → conspiración → integridad → opinión (cada uno lee las
salidas del anterior) y era antes del `SeasonReport` (265+) para salir en
portada.

### 9.3 Módulos engine nuevos

`characters.ts` · `politics.ts` · `assembly.ts` · `pledges.ts` · `integrity.ts`
· `desk.ts` · `conspiracy.ts` · `eras.ts` — más ediciones acotadas en
`engine.ts` (impulsos → exposición; mandatos ×3), `names.ts` (pools),
`headlines.ts` (plantillas con personajes), `economy.ts` (multiplicador de
opinión, prime time), `events.ts` (etiquetas de opinión), `board.ts` (moción),
`demands.ts` (contraoferta), `negotiation.ts` (concesión), `norms.ts`
(oposición), `season-report.ts` (era + citas), `migrations.ts` (v17–v22),
`types.ts`, `index.ts`.

### 9.4 Backend

- Controllers nuevos: `assembly.controller.ts`, `desk.controller.ts`.
- Controllers extendidos: `governance` (integridad + conspiración),
  `season` (elección de mandato en pretemporada; `advance` aplica despacho y
  resuelve votaciones), `game` (estado enriquecido).
- **Breaking deliberado:** las 7 acciones asamblearias dejan de tener vía
  unilateral (409 + `requiresAssembly`). El frontend migra en el mismo PR.
- Proyecciones SQL: sin tablas nuevas obligatorias (todos los ledgers viven en
  el JSONB y se consultan por juego). Opcional post-fase: proyectar
  `assembly_votes` para consultas históricas.

### 9.5 Frontend

- Páginas nuevas: `AssemblyPage`.
- Componentes: panel "El despacho" (Dashboard), tercer stat pill + PC (HUD de
  `GameLayout`), banner de crisis (17F), pestaña Integridad, pestaña Libro de
  promesas, bloque Presidencia (TeamDetail), salón de la fama / eras
  (HistoryPage), portada de era en `SeasonNewspaper`.
- `api.ts`: ~12 funciones nuevas tipadas desde contracts.

### 9.6 Orden de implementación y dependencias

```
17A Personajes ──┐
                 ├──► 17C Asamblea + Promesas ──► 17F Superliga ──► 17G Eras + pulidos
17B Opinión+PC ──┤
                 ├──► 17D Escándalos
                 └──► 17E Despacho
```

Orden recomendado de merge: **A → B → C → D → E → F → G.** D y E son
paralelizables tras B. Estimación relativa: A (S), B (M), C (**L**, el corazón
de la fase), D (M), E (M), F (M), G (M). Cada sub-fase es un PR mergeable con
su migración, sus tests y su UI — el juego es jugable y coherente tras cada
merge.

### 9.7 Criterios de aceptación de la fase

1. Una partida nueva presenta las tres circunscripciones en el HUD desde el
   día 1, y ninguna decisión de las tablas de 17B/17E mueve las tres en la
   misma dirección.
2. Crear una norma exige ganar una votación; es posible perder una votación,
   hacer lobby con 2 promesas y 2 PC, y ganar la repetición — y ambas promesas
   aparecen luego verificadas (una cumplida, una rota, con sus efectos).
3. Gastar 4 impulsos en una temporada produce escándalo en una mayoría de
   seeds; gastar 1 casi nunca.
4. Un save de la v16 migra a v22 sin pérdida, con presidentes generados, era
   retro-evaluada y cero campos `undefined`.
5. `pnpm test` verde con: golden re-baselineado **solo** por 17G (un único
   diff de snapshot, revisado), invariantes nuevas de §10, y los tests
   unitarios previos **sin ninguna edición** (prueba de que el engine siguió
   siendo permisivo).
6. Simular 20 temporadas seguidas ignorando despacho, asamblea e integridad es
   posible — más pobre, pero posible (el pilar "simular rápido" sobrevive).

## 10. Invariantes nuevas (consolidado para `invariants.test.ts`)

1. `publicOpinion ∈ [0,100]`; `politicalCapital ∈ [0,12]`; `exposureRisk ∈ [0,95]`;
   `grudge ∈ [0,100]` — tras cualquier secuencia de temporadas con seeds aleatorios.
2. Todo equipo de la federación del jugador tiene exactamente un presidente vigente.
3. `pledges`, `integrityCases` (en estado terminal), `conspiracyHistory`,
   `opinionHistory`, `eraHistory` son append-only.
4. Una propuesta `aprobada` implica su efecto aplicado (norma existe, reparto
   cambiado…); una `rechazada` implica cero efecto.
5. Sin impulsos gastados no hay escándalo de exposición; sin condiciones de
   trigger no hay conspiración.
6. Jugador 100 % pasivo durante 6 temporadas ⇒ `state.history` idéntico al
   golden vigente (post-re-baseline de 17G).
7. Los streams `rng`, `rivalRng`, `attributionRng`, `eventsRng`, `cupsRng`,
   `transfersRng`, `mandatesRng`, `demandsRng`, `talentRng` consumen exactamente
   los mismos draws que antes de la fase en una partida pasiva (guard
   anti-contaminación; comparar estados de RNG serializados).

## 11. Fuera de alcance (explícito)

- Tácticas, alineaciones, contratos de jugadores, mercado dirigido por el
  jugador — **nunca** (invariante de identidad del juego).
- Sesgo de comportamiento por rasgo en `rival-sim.ts` (17A.2, post-fase, con su
  propio re-baseline).
- Proyección SQL de votaciones históricas.
- Formatos de liga nuevos (playoffs, apertura/clausura): la asamblea deja el
  rail puesto (`cambio_formato`), pero los formatos en sí son una fase futura.
- Multijugador, negociación entre comisionados humanos, y cualquier UI que no
  sea de datos.
