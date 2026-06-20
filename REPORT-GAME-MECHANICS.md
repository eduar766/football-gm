# Football GM — Game Mechanics Analysis & Improvement Plan

*Analysis date: June 2026. All line references target `packages/engine/src/`.*

---

## 1. System Map

### 1.1 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GameState (types.ts)                        │
│  seed, rng, year, phase, prestige, treasury, fixtures, results,    │
│  teams[], players[], federations[], negotiations[], events[],      │
│  cups[], norms[], sanctions[], commercialContracts[], awards[],     │
│  transfers[], competitionPrizes[], prizePayments[], history[]      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
    ┌─────▼─────┐           ┌──────▼──────┐          ┌───────▼───────┐
    │ PRETEMPORADA│          │  TEMPORADA   │          │  CLOSE SEASON │
    │  (engine)  │          │  (engine)    │          │   (engine)    │
    └─────┬─────┘           └──────┬──────┘          └───────┬───────┘
          │                        │                         │
          │ WRITES:                │ WRITES:                 │ WRITES:
          │ fixtures[]             │ results[]               │ history[]
          │ cupSchedule[]          │ awards[] (per player)   │ awards[]
          │                        │ events[]                │ transfers[]
          │                        │ cup matches             │ prizePayments[]
          │                        │                         │ team.strength
          │                        │                         │ team.federationId
          │                        │                         │ prestige
          │ READS:                 │ READS:                  │ treasury
          │ teams[]                │ teams[]                 │ negotiations[].state
          │ cups[]                 │ players[]               │
          │ divisions[]            │ pendingImpulses[]       │ READS:
          │                        │ cupSchedule[]           │ standings (computed)
          │                        │                         │ norms ↔ teams
          │                        │                         │ contracts → economy
          └────────────────────────┼─────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
       ┌──────▼──────┐    ┌───────▼───────┐    ┌───────▼───────┐
       │   MATCH     │    │  ECONOMY      │    │ NEGOTIATION   │
       │  (match.ts) │    │ (economy.ts)  │    │(negotiation.ts│
       │             │    │               │    │               │
       │ READS:      │    │ READS:        │    │ READS:        │
       │ home.strength│   │ contracts[]   │    │ teams[]       │
       │ away.strength│   │ treasury      │    │ federations[] │
       │ favoredTeam │    │ economy       │    │ year          │
       │             │    │               │    │               │
       │ OUTPUT:     │    │ WRITES:       │    │ WRITES:       │
       │ homeGoals   │    │ treasury      │    │ teams[].federationId│
       │ awayGoals   │    │ contractOffers│    │ teams[].arraigo│
       │             │    │ lastEconomy   │    │ federations[].prestige│
       └──────┬──────┘    └───────────────┘    │ negotiations[].state│
              │                                └───────────────┘
       ┌──────▼──────┐
       │ ATTRIBUTION │
       │ (awards.ts) │
       │             │
       │ READS:      │
       │ players[]   │
       │             │
       │ WRITES:     │
       │ season.goals│
       │ season.assists│
       │ suspendedLeft│
       │ injuredLeft │
       └─────────────┘

  ┌────────────┐   ┌────────────┐   ┌────────────┐
  │  EVENTS    │   │   NORMS    │   │   PRIZES   │
  │(events.ts) │   │ (norms.ts) │   │(prizes.ts) │
  │            │   │            │   │            │
  │ READS:     │   │ READS:     │   │ READS:     │
  │ players[]  │   │ norms[]    │   │ standings  │
  │ teams[]    │   │ teams[]    │   │ cup results│
  │            │   │ players[]  │   │            │
  │ WRITES:    │   │            │   │ WRITES:    │
  │ events[]   │   │ WRITES:    │   │ treasury   │
  │ prestige   │   │ sanctions[]│   │ prizePayments│
  │ treasury   │   │ prestige*  │   └────────────┘
  │ teams[].arr│   └────────────┘
  └────────────┘

  ┌────────────┐   ┌────────────┐   ┌────────────┐
  │  TRANSFERS │   │   CUPS     │   │ SALARIES   │
  │(transfers) │   │ (cups.ts)  │   │(salaries.ts│
  │            │   │            │   │            │
  │ READS:     │   │ READS:     │   │ READS:     │
  │ players[]  │   │ teams[]    │   │ players[]  │
  │ teams[]    │   │ cupsRng    │   │            │
  │            │   │            │   │ OUTPUT:    │
  │ WRITES:    │   │ WRITES:    │   │ wageBill() │
  │ players[]. │   │ cup.rounds │   └─────┬──────┘
  │   teamId   │   │ cup.status │         │ (consumed by norms.ts)
  │ transfers[]│   │ cup.champion│        │
  │ teams[].str│   └────────────┘   ┌─────▼──────┐
  └────────────┘                    │ STRUCTURE  │
                                    │(structure.ts│
  ┌────────────┐                    │            │
  │  FIXTURES  │                    │ READS:     │
  │(fixtures.ts│                    │ teams[]    │
  │            │                    │ divisions[]│
  │ OUTPUT:    │                    │            │
  │ Fixture[]  │                    │ WRITES:    │
  └────────────┘                    │ teams[].division│
                                    │ divisions[]│
                                    └────────────┘
```

### 1.2 Isolated RNG Streams

The engine uses **6 independent RNG streams** to maintain golden-master determinism:

| RNG field | Used by | Purpose |
|-----------|---------|---------|
| `state.rng` | match.ts, fixtures.ts, structure.ts | Core simulation (fixtures, match goals) |
| `attributionRng` | awards.ts | Goal/assist assignment, cards, injuries |
| `eventsRng` | events.ts | Event spawn timing and content |
| `cupsRng` | cups.ts | Cup draws, knockout tiebreakers |
| `transfersRng` | transfers.ts | Transfer targeting and acceptance |
| (derived from seed+year) | economy.ts | Contract offer generation |

### 1.3 Player Decision Points

| Decision | Phase | Function | Effect |
|----------|-------|----------|--------|
| Apply impulse | temporada | `applyImpulse()` | +12 strength boost to one team in one match |
| Resolve event | temporada | `resolveEvent()` | Act (cost €1M, -3 arraigo) or ignore (-1 prestige) |
| Set league format | pretemporada | `setLeagueFormat()` | Ida (1 leg) or ida_y_vuelta (2 legs) |
| Create team | pretemporada | `createOwnTeam()` | -€5M, +1 team in lowest division |
| Start negotiation | pretemporada | `startNegotiation()` | Begin multi-year process to poach a rival team |
| Sign contract | pretemporada | `signContract()` | Accept a commercial offer (sponsorship/TV/etc) |
| Cancel contract | pretemporada | `cancelContract()` | Break a commercial deal |
| Set economy policy | pretemporada | `setEconomyPolicy()` | Talent investment level |
| Add/remove norm | pretemporada | `addNorm()` / `removeNorm()` | Define league rules |
| Sanction team | pretemporada | `sanctionTeam()` | Penalize rule-breakers (-3 points) |
| Create cup | pretemporada | `createCup()` | Add a tournament |
| Set league prize | pretemporada | `setLeaguePrize()` | Prize pool + distribution |
| Set cup prize | pretemporada | `setCupPrize()` | Prize pool + distribution |
| Run leveling league | pretemporada | `runLevelingLeague()` | Redistribute teams across divisions |
| Advance matchday | temporada | `advanceMatchday()` | Simulate one round of matches |
| Advance season | temporada | `advanceSeason()` | Simulate until event or end |

**Total decision points: 16** (3 during temporada, 13 during pretemporada)

---

## 2. Mechanical Evaluation

### 2.1 Match Simulation (`match.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 2/5 | Pure RNG output — no narrative, no surprise. Just two numbers. |
| Depth | 1/5 | Weighted Poisson. Home advantage (+6), impulse boost (+12). No tactics, no form, no weather, no injuries affecting the match. |
| Agency | 2/5 | Impulse system is the only lever. 3 per season, binary +12 boost. |
| Coherence | 4/5 | Feeds cleanly into standings, attribution, awards. |
| Emergence | 2/5 | Poisson gives realistic score distributions, but no emergent narratives. |

**Overall: 2.2/5** — Functional but bare. The match engine is the heartbeat of the game yet produces only raw scores.

### 2.2 Standings & Fixtures (`standings.ts`, `fixtures.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 3/5 | Table races are inherently engaging. The title race gap bonus in prestige is smart. |
| Depth | 2/5 | Standard 3pts/win table. No head-to-head tiebreaker, no away goals. Tiebreakers are goal diff → goals for → name. |
| Agency | 1/5 | Zero decisions here. Pure output. |
| Coherence | 5/5 | Central nervous system — everything reads from standings. |
| Emergence | 3/5 | Close title races create natural drama; the gap-based prestige formula rewards competitive balance. |

**Overall: 2.8/5** — Solid foundation, but tiebreakers could add nuance.

### 2.3 Negotiation Lifecycle (`negotiation.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 4/5 | Multi-year strategic investment. The tension of "will they accept?" is real. |
| Depth | 4/5 | Tier gates, arraigo resistance, prestige differential, 1-3 year gathering + 2 year delay. Multiple levers interact. |
| Agency | 4/5 | Player chooses targets, manages tier growth, timing. |
| Coherence | 5/5 | Connects prestige, tiers, arraigo, reactive rivals. Best-integrated system. |
| Emergence | 3/5 | Reactive rivals raising arraigo is a good counter-force. Could be richer. |

**Overall: 4.0/5** — The strongest system. Deep, coherent, strategic.

### 2.4 Economy & Finance (`economy.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 2/5 | Sign-or-don't decisions on contracts. No revenue streams to manage. |
| Depth | 2/5 | Contracts are take-or-leave offers. Treasury goes up or down. Financial health check is binary (<0 = quiebra). |
| Agency | 3/5 | Player chooses contracts, talent investment level. But no pricing, no negotiation, no timing. |
| Coherence | 3/5 | Connected to prestige (offer quality scales with prestige) and treasury (prizes cost money). But disconnected from transfers and team strength. |
| Emergence | 1/5 | No surprise here — income is deterministic from contracts. |

**Overall: 2.2/5** — The financial tension snowball brake exists in theory but lacks engaging decisions.

### 2.5 Salary System (`salaries.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 1/5 | Pure helper function. No decisions, no visibility. |
| Depth | 2/5 | Quadratic formula from quality. Used only for tope_salarial norm check. |
| Agency | 1/5 | Player has no control over salaries. |
| Coherence | 2/5 | Only consumed by norms.ts for salary cap check. Completely disconnected from economy, transfers, team behavior. |
| Emergence | 0/5 | None. |

**Overall: 1.2/5** — Exists as plumbing, not a system. Salaries should drive team decisions (can't afford a star → forced sale).

### 2.6 Awards & Attribution (`awards.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 3/5 | Top scorer / assist / keeper races are classic football drama. |
| Depth | 2/5 | Three categories only. No MVP, no team of the season, no breakthrough player. |
| Agency | 1/5 | Zero decisions. Pure observation. |
| Coherence | 2/5 | Awards are append-only history. They don't affect transfers, player value, prestige, or anything. |
| Emergence | 2/5 | A surprise top scorer from a weak team is fun, but it leads nowhere. |

**Overall: 2.0/5** — Awards are recorded but have no consequences. A missed opportunity to create feedback loops.

### 2.7 Events / Polémicas (`events.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 3/5 | Decision moments during the season. The act-or-ignore tension works. |
| Depth | 2/5 | Only 3 event types. Binary choice (act/ignore). No chaining, no investigation, no partial resolution. |
| Agency | 3/5 | Player decides, but the choices are always the same. |
| Coherence | 2/5 | Events don't connect to norms, transfers, or cups. They're a prestige/arraigo tax. |
| Emergence | 2/5 | Random timing is good, but events never escalate or combine. |

**Overall: 2.4/5** — The bones are right (independent rng, rare interruptions, decision points) but the flesh is thin.

### 2.8 Norms & Sanctions (`norms.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 3/5 | Setting rules and catching violators is satisfying governance. |
| Depth | 3/5 | Three norm types. Sanction is binary (apply or not). No escalation, no repeat offender tracking, no warnings. |
| Agency | 4/5 | Player defines rules, decides whom to sanction. Real commissioner work. |
| Coherence | 3/5 | Connected to standings (points penalty) and prestige (governance penalty). But norms don't affect team AI behavior. |
| Emergence | 2/5 | The governancePenalty for unsanctioned breaches is a nice catch, but norms never create cascading drama. |

**Overall: 3.0/5** — Good governance feel, but norms are static — they never provoke interesting dilemmas.

### 2.9 Prizes (`prizes.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 2/5 | Set and forget. No mid-season tension. |
| Depth | 2/5 | Pool + share table. No conditional prizes, no bonuses, no appearance fees. |
| Agency | 3/5 | Player decides allocation (which positions get paid how much). |
| Coherence | 3/5 | Connected to standings (league) and cups. Debits treasury. |
| Emergence | 1/5 | Pure payout. Never creates drama. |

**Overall: 2.2/5** — Functional payout mechanism. Could drive much more strategic depth with conditional prizes.

### 2.10 Transfers (`transfers.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 2/5 | Automated window. Player watches it happen. No transfer fees, no contract negotiations. |
| Depth | 2/5 | Clubs bid weighted by strength. 50% success rate. No wage considerations, no player preferences, no sell-on clauses. |
| Agency | 1/5 | Zero decisions. Fully automated. |
| Coherence | 2/5 | Only moves players within the player's federation. Ignores economy entirely (no fees). Team strength recomputed but no financial impact. |
| Emergence | 2/5 | A star moving from weak to strong club is a natural narrative, but it's invisible — no fees, no drama. |

**Overall: 1.8/5** — The most underdeveloped core system. Transfers should be a major strategic layer.

### 2.11 Cups / Tournaments (`cups.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 3/5 | Cup drama is inherently exciting. Knockout tension. |
| Depth | 3/5 | Knockout and round-robin formats. Youth category. But no two-leg ties, no away goals, no penalties. |
| Agency | 3/5 | Player creates cups, chooses format and participants. |
| Coherence | 3/5 | Connected to prizes (payCupPrize), schedule (interleaved with league). Uses youth strength for juvenil. |
| Emergence | 3/5 | Upsets in knockout rounds create natural drama. |

**Overall: 3.0/5** — Good foundation. Needs penalty shootouts, aggregate scoring, and more cup variety.

### 2.12 Division Structure (`structure.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 2/5 | Leveling league is a one-time event. Not much drama. |
| Depth | 3/5 | Multi-division system, promotion/relegation, MAX_DIVISION_SIZE constraint. |
| Agency | 3/5 | Player runs leveling league, can expand divisions. |
| Coherence | 4/5 | Central to the league identity. Connects to negotiation (teams need division slots), standings, promotion/relegation. |
| Emergence | 2/5 | Promotion/relegation battles emerge from standings, but there's no mid-table drama or relegation six-pointers. |

**Overall: 2.8/5** — Structural backbone works. Could use playoff systems, relegation battles with higher stakes.

### 2.13 Impulse System (`engine.ts:249-273`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 3/5 | The "thumb on the scale" concept is fun. Choosing when and where to use limited impulses creates decisions. |
| Depth | 3/5 | 3 per season, +12 boost, current matchday or future. Good constraint. |
| Agency | 4/5 | Real commissioner power fantasy — directly influencing outcomes. |
| Coherence | 3/5 | Applied during match simulation. Visible in results. But no strategic interaction with other systems. |
| Emergence | 2/5 | Impulses never create cascading effects (e.g., saving a team from relegation with an impulse). |

**Overall: 3.0/5** — The concept is excellent. The implementation is thin. Impulses should have visible consequences and reputation effects.

### 2.14 Team Creation (`engine.ts:278-322`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 2/5 | Pay €5M, get a weak team. One decision, done. |
| Depth | 2/5 | Fixed cost, fixed strength (35), fixed arraigo (75). No customization. |
| Agency | 2/5 | Player names the team and optionally seeds the squad. |
| Coherence | 3/5 | Starts in lowest division. Costs money (§5 tension). |
| Emergence | 1/5 | Created teams are static — no growth narrative, no identity. |

**Overall: 2.0/5** — Good concept (build vs. buy), but needs investment tiers, youth academy linkage, and growth potential.

### 2.15 Season Lifecycle (`engine.ts`)

| Metric | Score | Notes |
|--------|-------|-------|
| Fun | 3/5 | The pretemporada → temporada → close cycle works. Season transition has weight. |
| Depth | 3/5 | Many decisions in pretemporada, few in temporada. The tempo is good but temporada is mostly passive. |
| Agency | 3/5 | 13 pretemporada decisions, 3 temporada decisions. Heavily front-loaded. |
| Coherence | 5/5 | Everything hangs off this lifecycle. Clean architecture. |
| Emergence | 3/5 | Multi-season arcs emerge naturally from history + negotiation timelines. |

**Overall: 3.4/5** — The lifecycle is well-designed. The main weakness is the "desert" in the middle of temporada.

---

## 3. Disconnected Systems

### 3.1 Transfers ↔ Economy

**What's missing:** No transfer fees. Players move for free.

**Why it matters:** Without fees, transfers have zero financial consequence. A star player moving to a rival costs nothing. The §5 financial tension brake ("expandirte arruina") doesn't fire because transfers are free.

**Concrete fix:**
- Add `TransferFee` field to `TransferEntry` type (`types.ts:297`)
- In `runTransferWindow()`, compute fee as `buyer.strength * 50_000 + target.calidad * 100_000`
- Debit fee from `s.treasury` (buyer's federation treasury = the player's treasury)
- Record fee in `TransferEntry`
- Add `transferFees` to `LastEconomy` type for UI visibility
- Files: `types.ts`, `transfers.ts`, `economy.ts`

### 3.2 Events ↔ Norms

**What's missing:** Events don't interact with norms. An `arbitraje_dudoso` event could trigger a norm review. An `incidente_aficion` could be grounds for a `minimo_competitivo` review.

**Why it matters:** Events feel like isolated prestige taxes instead of governance tools. A commissioner should be able to use events as evidence for sanctions.

**Concrete fix:**
- Add optional `linkedNormId: number | null` and `linkedTeamId: number | null` to `GameEvent` (`types.ts:174`)
- When resolving an event with `actuar`, if the event targets a team that has a norm breach, auto-sanction them
- Events of type `declaraciones_polemicas` could add `arraigo` penalty to the team's current federation (making poaching easier)
- Files: `types.ts`, `events.ts`, `norms.ts`

### 3.3 Awards ↔ Transfers

**What's missing:** Top performers (golden boot winner, best assister) are not more likely to be transferred. Awards are historical decorations only.

**Why it matters:** In real football, awards dramatically increase a player's market value. Here, awards are write-only — they affect nothing.

**Concrete fix:**
- After `settleSeasonAwards()`, tag award-winning players with a `transferValue` multiplier (e.g., 1.5x)
- In `runTransferWindow()`, use `transferValue` as an additional weight when selecting targets
- Add `awardedPlayerIds: Set<number>` to `GameState` (transient, per-window)
- Files: `awards.ts`, `transfers.ts`, `types.ts`

### 3.4 Youth System ↔ First Team

**What's missing:** `team.youthStrength` (`types.ts:36`) is used only by cups (`cups.ts:63` — `effectiveTeam()`). It never feeds into first-team development, never generates new players, never influences anything else.

**Why it matters:** Youth academies are a core football management lever. Here they're a cosmetic field for youth cups.

**Concrete fix:**
- At season close (`engine.ts:closeSeason()`), generate 1-2 new `Player` entries for each team from the youth strength
- New players have `calidad = youthStrength ± randInt(rng, -5, 5)`
- `youthStrength` slowly drifts based on `economy.talentInvestment` (connect economy → youth)
- Files: `engine.ts`, `types.ts`

### 3.5 Cups ↔ Prizes (Partial)

**What's missing:** Cup prizes work (`payCupPrize` is called), but:
- No cup participation fee (teams get nothing just for showing up)
- Cup performance doesn't affect prestige
- Cup champions don't get a prestige boost in history

**Concrete fix:**
- Add `participationFee: number` to `CompetitionPrize` (`types.ts:264`)
- Every participating team receives the fee when the cup is created (pretemporada)
- Cup champion gets a prestige boost in `closeSeason()`: `+3` for winning, `+1` for finalist
- Files: `types.ts`, `prizes.ts`, `engine.ts`

---

## 4. Strategic Depth Proposals

### Proposal 1: Mid-Season Agency — Commissioner Interventions

**What:** Add 3 new commissioner actions available during `temporada` (beyond impulses):
1. **Call a review** — challenge a specific match result (referee mistake). Costs €500K. Has a 70% chance of replaying the match. Uses eventsRng.
2. **Emergency board meeting** — force a team to change coach (team strength ±5 random shift). Costs €200K. Once per season.
3. **Postpone matchday** — delay one matchday by 1 week (allows injured players to recover). No cost, but prestige -1 (disrupts schedule).

**Why:** Currently `temporada` has only impulses (3 per season) and event resolution. The "advance matchday" loop is passive 95% of the time. These give the player agency without breaking the "few interruptions" principle.

**Files to modify:**
- `types.ts`: add `PostponedMatchday`, `CommissionerAction` types
- `engine.ts`: add `callReview()`, `emergencyMeeting()`, `postponeMatchday()` functions
- `match.ts`: no changes (review replays by re-running simulateMatch with same fixture)

**Complexity:** MEDIUM (~120 LOC)
**Impact:** HIGH — transforms temporada from passive watching to active management
**Risk:** Low — doesn't affect the 3 principles. Commissioner exercising authority is on-brand.

### Proposal 2: Rival AI — Reactive Federation Behavior

**What:** Rival federations take autonomous actions during `closeSeason()`:
1. **Defensive poaching** — a rival with prestige > 30 can attempt to steal teams from the player. Uses same negotiation mechanics (tier gate, arraigo resistance).
2. **Investment** — rivals invest in talent (equivalent to talentInvestment) raising their teams' strength.
3. **Price war** — when the player poaches a team, rival federations lower their own tier thresholds temporarily (they become more accessible).
4. **Alliance formation** — two weak rivals (prestige < 20 each) can merge into one stronger rival (prestige = sum × 0.6).

**Why:** Currently rivals are static except for the arraigo bump in `progressNegotiations()`. The design doc §5 explicitly calls for "federaciones reactivas." Without active rivals, the game is solvable — just poach methodically.

**Files to modify:**
- `types.ts`: add `RivalAction` type
- `engine.ts`: add `processRivalActions()` called from `closeSeason()`
- `negotiation.ts`: add `rivalPoachAttempt()` function

**Complexity:** HIGH (~250 LOC)
**Impact:** HIGH — creates genuine strategic pressure and unpredictability
**Risk:** Medium — must ensure rival AI doesn't feel unfair. Needs visible indicators ("Rival Federation X is courting your teams").

### Proposal 3: Transfer Depth — Fees, Wages, Windows

**What:**
1. **Transfer fees** — computed from player quality × club strength. Debited from federation treasury.
2. **Wage budget** — each team has a wage cap derived from its federation's treasury share. Can't sign players above the cap.
3. **Transfer windows** — two windows per year (pretemporada and mid-season). Mid-season window is shorter (fewer attempts).
4. **Sell-on clause** — when a player moves from your league, you receive 10% of the fee.

**Why:** Transfers are currently free and automated. Adding fees creates financial strategy (can you afford that star?). Wage budgets prevent runaway squad building. Mid-season windows add drama.

**Files to modify:**
- `types.ts`: add `wageCap`, `transferFee`, `sellOnClause` fields
- `transfers.ts`: rework `runTransferWindow()` to compute fees, check wage budgets
- `economy.ts`: add `transferIncome` to `LastEconomy`
- `engine.ts`: add `runMidSeasonWindow()` call in mid-season

**Complexity:** HIGH (~300 LOC)
**Impact:** HIGH — transforms transfers from a background process to a strategic layer
**Risk:** Low — purely additive, doesn't change existing contract negotiation flow

### Proposal 4: Player Career Arcs — Aging, Growth, Decline

**What:**
- Players have `age` field (start at 18-28 depending on quality)
- Each season: quality changes based on age curve (peak at 27-30, decline after 32)
- Retirement at age 37+ (or when quality < 25)
- "Breakthrough" events: young players with high youthStrength can have quality jumps

**Why:** Currently `team.strength` drifts ±3 per season (`engine.ts:471`). There's no narrative of a player rising, peaking, and declining. This creates human stories within the data.

**Files to modify:**
- `types.ts`: add `age: number` to `Player`
- `engine.ts`: replace the flat drift with age-curve-based evolution in `closeSeason()`
- `awards.ts`: adjust award weights by age (young player bonus)

**Complexity:** MEDIUM (~150 LOC)
**Impact:** MEDIUM — creates narratives but doesn't add decision points
**Risk:** Low — doesn't violate any principles. Commissioner doesn't manage players directly.

### Proposal 5: Event Variety — Chaining, Escalation, Consequences

**What:**
- Add 5 new event types: `doping_positivo`, `conflicto_jugadores`, `crisis_economica_club`, `escandalo_directiva`, `manipulacion_resultados`
- Events can chain: an `incidente_aficion` that's ignored can escalate to `doping_positivo` next season
- `manipulacion_resultados` is a major event: if acted upon, the team is relegated 1 division
- Events now have `severity: 'baja' | 'media' | 'alta'` — severity affects prestige cost and investigation cost

**Why:** 3 event types with binary choices become repetitive. Chaining and severity create narrative arcs. A single ignored incident spiraling into a scandal is compelling drama.

**Files to modify:**
- `types.ts`: expand `EventType`, add `severity`, add `chainedFromId`
- `events.ts`: expand `maybeSpawnEvent()`, add `escalateEvent()` function

**Complexity:** MEDIUM (~180 LOC)
**Impact:** HIGH — events become stories, not just prestige taxes
**Risk:** Low — events are already isolated. More variety is safe.

### Proposal 6: Norm Escalation — Repeat Offenders

**What:**
- Track violation history per team: `teamViolations: Map<teamId, Map<normId, count>>`
- First breach: standard sanction (3 points)
- Second breach same season: 5 points
- Third breach same season: 8 points + relegation warning
- "Good behavior" reset: 2 clean seasons removes escalation

**Why:** Currently every breach is 3 points regardless of history. A team that breaches every season faces no escalating consequences. Real football has escalating sanctions.

**Files to modify:**
- `types.ts`: add `violationHistory` to `GameState`
- `norms.ts`: modify `sanctionTeam()` to read escalation, modify `SANCTION_POINTS`

**Complexity:** LOW (~60 LOC)
**Impact:** MEDIUM — creates long-term governance strategy
**Risk:** Low — additive, doesn't change existing sanction flow

### Proposal 7: Cross-Federation Dynamics — Global Ranking

**What:**
- Compute a global ranking across all federations based on: average team strength, prestige, number of teams, and head-to-head results (friendly matches between federation teams)
- Rankings published at season close
- Top-ranked federation gets a prestige bonus (+2)
- New negotiation option: "friendlies" — arrange cross-federation matches that affect ranking

**Why:** Currently federations are isolated except for poaching. A global ranking creates competition between federations beyond just team theft. It gives prestige meaning beyond tier gating.

**Files to modify:**
- `types.ts`: add `GlobalRanking`, `Friendly` types
- `engine.ts`: add `computeGlobalRanking()` in `closeSeason()`
- `negotiation.ts`: add `arrangeFriendly()` function

**Complexity:** HIGH (~200 LOC)
**Impact:** MEDIUM — adds competitive context but doesn't change core decisions
**Risk:** Low — purely informational with small prestige effects

### Proposal 8: Match Narrative — Richer Output

**What:**
- `MatchResult` gains `goalscorers: Array<{playerId, minute}>`, `yellowCards`, `redCards`, `manOfTheMatch`
- Match output includes a text summary: "3-1: De scoring by Player A (12'), Player B (45'). Red card: Player C (78')"
- A `MatchReport` type stored alongside results for UI consumption

**Why:** Currently match output is just two numbers. A match narrative transforms "3-1" into a story. This is the most requested feature for any data-only football game.

**Files to modify:**
- `types.ts`: add `Goalscorer`, `MatchReport` types, expand `MatchResult`
- `match.ts`: return richer output
- `awards.ts`: attribution already tracks scorers — just need to expose them
- `engine.ts`: store `MatchReport[]` in GameState

**Complexity:** MEDIUM (~130 LOC)
**Impact:** HIGH — transforms the reading experience of results
**Risk:** Low — purely additive output. Doesn't change simulation logic.

### Proposal 9: Economy Depth — Revenue Streams, Fan Engagement

**What:**
- **Matchday revenue** — earned per home match, based on attendance (affected by team strength, prestige, division)
- **Merchandise** — sold to fans, revenue scales with league-wide prestige
- **Youth academy investment** — player sets a per-team youth budget; higher investment → faster youthQuality growth
- **Stadium expansion** — one-time cost to increase matchday capacity

**Why:** Currently economy is: sign contracts → pay operating costs → maybe invest in talent. There's no per-team financial management, no revenue optimization, no growth narrative.

**Files to modify:**
- `types.ts`: add `matchdayRevenue`, `merchandise`, `youthBudget` fields
- `economy.ts`: add revenue calculations
- `engine.ts`: integrate youthBudget into talentInvestment

**Complexity:** HIGH (~250 LOC)
**Impact:** MEDIUM — adds depth but the commissioner doesn't manage individual teams
**Risk:** Medium — must be careful not to drift into team-management territory. Revenue is federation-level, not team-level.

### Proposal 10: Cup Drama — Penalties, Aggregate, Draw Ceremony

**What:**
- **Penalty shootouts** — when knockout matches are tied after regulation, simulate penalties (separate RNG, 70% chance for the stronger team)
- **Aggregate scoring** — two-leg knockout ties (home + away, aggregate goals decide)
- **Draw ceremony** — when creating a cup, generate a visible bracket with team names and seedings
- **Cup upset bonus** — when a team beats a team 20+ quality points higher, the winning team gets +2 prestige

**Why:** Currently knockout ties are decided by a coin flip (`rngNext() < 0.5`). Penalties add drama. Aggregate scoring is standard in real cups. Draw ceremonies make cups feel like real events.

**Files to modify:**
- `cups.ts`: add `simulatePenalties()`, modify `playPendingInRound()` for aggregate, add `generateBracket()`
- `types.ts`: add `aggregateHome`, `aggregateAway` to `CupMatch`
- `engine.ts`: cup upset prestige bonus in `playCupRound()`

**Complexity:** MEDIUM (~150 LOC)
**Impact:** HIGH — cups become genuinely dramatic
**Risk:** Low — cups are self-contained. Changes don't affect the league.

---

## 5. Priority Matrix

| # | Proposal | Fun Impact | Strategic Depth | Complexity | Risk | Priority |
|---|----------|-----------|----------------|------------|------|----------|
| 8 | Match Narrative | ★★★★★ | ★★★ | MEDIUM | LOW | **P0** |
| 1 | Mid-Season Agency | ★★★★★ | ★★★★ | MEDIUM | LOW | **P0** |
| 3 | Transfer Depth | ★★★★ | ★★★★★ | HIGH | LOW | **P1** |
| 10 | Cup Drama | ★★★★ | ★★★ | MEDIUM | LOW | **P1** |
| 5 | Event Variety | ★★★★ | ★★★ | MEDIUM | LOW | **P1** |
| 6 | Norm Escalation | ★★★ | ★★★ | LOW | LOW | **P1** |
| 2 | Rival AI | ★★★★ | ★★★★★ | HIGH | MED | **P2** |
| 4 | Player Career Arcs | ★★★ | ★★★ | MEDIUM | LOW | **P2** |
| 7 | Cross-Federation | ★★★ | ★★★ | HIGH | LOW | **P2** |
| 9 | Economy Depth | ★★★ | ★★★ | HIGH | MED | **P3** |

---

## 6. Implementation Plan

### Release 1: Quick Wins (Week 1-2)

**Goal:** Immediate fun boost with minimal risk. Match narratives and mid-season actions.

#### 1a. Match Narrative (`match.ts`, `types.ts`, `awards.ts`, `engine.ts`)

**Files to modify:**
- `types.ts`:
  - Add `Goalscorer` interface: `{ playerId: number; minute: number }`
  - Add `MatchReport` interface: `{ matchday: number; divisionOrden: number; homeId: number; awayId: number; homeGoals: number; awayGoals: number; goalscorers: Goalscorer[]; homeYellowCards: number; awayYellowCards: number; homeRedCards: number; awayRedCards: number }`
  - Add `matchReports: MatchReport[]` to `GameState` (line 371)
- `match.ts`:
  - Modify `simulateMatch()` to return goalscorer data alongside scores
  - Add minute generation: for each goal, `minute = randInt(rng, 1, 90)`
- `awards.ts`:
  - In `attributeMatchGoals()`, record which players scored in a temporary array
  - Return this data so `engine.ts` can build the `MatchReport`
- `engine.ts`:
  - In `advanceMatchday()` (line 324), build `MatchReport` from `simulateMatch()` output and `attributeMatchGoals()` data
  - Push to `s.matchReports`

**Test strategy:**
- Update `golden.test.ts` snapshot (new data = new snapshot)
- Add test: `matchReports.length === results.length` after a season
- Property test: every goalscorer in a report exists on the correct team

**Dependencies:** None. Self-contained.

#### 1b. Mid-Season Agency (`engine.ts`, `types.ts`)

**Files to modify:**
- `types.ts`:
  - Add `CommissionerAction` type: `'call_review' | 'emergency_meeting' | 'postpone_matchday'`
  - Add `ActionRecord` interface: `{ id: number; year: number; matchday: number; type: CommissionerAction; cost: number; targetTeamId: number | null }`
  - Add `actionHistory: ActionRecord[]` and `nextActionId: number` to `GameState`
- `engine.ts`:
  - Add `callReview(state, matchday, homeId, awayId)` → 70% chance to replay match (re-simulate), costs €500K
  - Add `emergencyMeeting(state, teamId)` → randomly shift team strength ±5, costs €200K, once per team per season
  - Add `postponeMatchday(state, matchday)` → skip this matchday, move injured players recovery forward, prestige -1

**Test strategy:**
- Test each action: verify treasury deduction, state mutation, one-per-season limit
- Test replay: verify the result actually changes (or doesn't if review fails)
- Golden test: add actions to the golden sequence, verify snapshot changes

**Dependencies:** None.

---

### Release 2: Core Depth (Week 3-5)

**Goal:** Add strategic depth to transfers, cups, events, and norms.

#### 2a. Transfer Depth (`transfers.ts`, `types.ts`, `economy.ts`)

**Files to modify:**
- `types.ts`:
  - Add `transferFee: number` to `TransferEntry` (line 297)
  - Add `wageCap: number` to `Team` (line 19)
  - Add `sellOnPercent: number` to `GameState`
- `transfers.ts`:
  - In `runTransferWindow()` (line 54), before accepting a transfer:
    - Compute `fee = buyer.strength * 50_000 + target.calidad * 100_000`
    - Check `s.treasury >= fee` (buyer's federation can afford it)
    - Debit `s.treasury -= fee`
    - Record fee in `TransferEntry`
  - Check wage cap: `wageBill(buyer.id, s.players) + playerSalary(target.calidad) <= buyer.wageCap`
- `economy.ts`:
  - Add `transferFees: number` to `LastEconomy` (line 283)
  - Add `transferIncome: number` (from sell-on clauses)

**Test strategy:**
- Test: transfers now record fees > 0
- Test: transfers fail when treasury < fee
- Test: transfers fail when wage cap exceeded
- Golden test: update snapshot

**Dependencies:** None.

#### 2b. Cup Drama (`cups.ts`, `types.ts`)

**Files to modify:**
- `types.ts`:
  - Add `aggregateHome: number | null` and `aggregateAway: number | null` to `CupMatch` (line 123)
- `cups.ts`:
  - Add `simulatePenalties(rng, home: Team, away: Team): { homePenalties: number; awayPenalties: number }` — simulated as sequential penalty kicks, stronger team has 55% chance per kick
  - Modify `playPendingInRound()` (line 115): when `knockout && homeGoals === awayGoals`, call `simulatePenalties()` instead of `rngNext() < 0.5`
  - Add `generateBracket(cup: Cup): string` — returns a formatted bracket string for UI
  - Add cup upset bonus: when winner quality > loser quality + 20, award +2 prestige to winner's federation

**Test strategy:**
- Test: knockout ties now have penalty outcomes
- Test: bracket generation produces valid output
- Test: upset bonus awards prestige correctly
- Golden test: update snapshot

**Dependencies:** None.

#### 2c. Event Variety (`events.ts`, `types.ts`)

**Files to modify:**
- `types.ts`:
  - Expand `EventType` union: add `'doping_positivo' | 'conflicto_jugadores' | 'crisis_economica_club' | 'escandalo_directiva' | 'manipulacion_resultados'`
  - Add `severity: 'baja' | 'media' | 'alta'` to `GameEvent` (line 174)
  - Add `chainedFromId: number | null` to `GameEvent`
- `events.ts`:
  - Expand `TYPES` array with new types and their probabilities
  - In `maybeSpawnEvent()`, assign severity based on type (doping = alta, declarations = baja, etc.)
  - Add `escalateEvent(state, eventId)` — chains a new event from an existing one, with higher severity
  - In `resolveEvent()`: `manipulacion_resultados` + `actuar` → relegate team 1 division
  - Adjust prestige costs by severity: baja=1, media=2, alta=4

**Test strategy:**
- Test: new event types spawn with correct severity
- Test: escalation creates chained events
- Test: manipulacion_resultados causes relegation
- Golden test: update snapshot

**Dependencies:** None.

#### 2d. Norm Escalation (`norms.ts`, `types.ts`)

**Files to modify:**
- `types.ts`:
  - Add `violationHistory: Map<number, Map<number, number>>` to `GameState` (teamId → normId → count)
- `norms.ts`:
  - In `sanctionTeam()` (line 89): look up violation count, increase `SANCTION_POINTS` based on count (3/5/8)
  - Increment count after sanctioning
  - In `closeSeason()` (via `engine.ts`): decay counts for teams with no violations this season (2 clean seasons = reset)

**Test strategy:**
- Test: second violation same season = 5 points
- Test: third violation = 8 points
- Test: 2 clean seasons resets escalation
- Golden test: update snapshot

**Dependencies:** None.

---

### Release 3: World Building (Week 6-9)

**Goal:** Active rival AI, player career arcs, cross-federation dynamics.

#### 3a. Rival AI (`engine.ts`, `negotiation.ts`, `types.ts`)

**Files to modify:**
- `types.ts`:
  - Add `rivalActions: RivalAction[]` to `GameState`
  - Add `RivalAction` interface: `{ federationId: number; type: 'poach' | 'invest' | 'price_war'; targetTeamId?: number; amount?: number }`
- `engine.ts`:
  - Add `processRivalActions(s: GameState)` called from `closeSeason()` after `progressNegotiations()`
  - Logic:
    - For each rival federation with prestige > 30: 20% chance to attempt poaching a random player-owned team (uses same tier/arraigo checks, but reversed)
    - For each rival with prestige < 15: auto-invest (equivalent to 2M talent investment)
    - When player poaches a team, set a "retaliation flag" — rivals get +10% poach chance next season
- `negotiation.ts`:
  - Add `rivalPoachAttempt(s, rivalFed, targetTeam)` — mirror of `startNegotiation()` but for AI
  - Store rival negotiations in `s.negotiations` with a `byFederationId` pointing to the rival

**Test strategy:**
- Test: rival poaching attempts create new negotiations
- Test: retaliation flag increases poach chance
- Test: weak rivals auto-invest
- Golden test: update snapshot (requires rivals in test setup)

**Dependencies:** None.

#### 3b. Player Career Arcs (`engine.ts`, `types.ts`)

**Files to modify:**
- `types.ts`:
  - Add `age: number` to `Player` (line 99)
  - Add `birthYear: number` to `Player`
- `engine.ts`:
  - In `createGame()` (line 71): set initial age based on quality (higher quality = older, peak at 27)
  - Replace flat drift (line 471) with:
    ```
    if (age < 27) quality += randInt(rng, 0, 2)  // growth
    else if (age < 32) quality += randInt(rng, -1, 1)  // peak
    else quality += randInt(rng, -3, -1)  // decline
    if (quality < 25 || age > 37) retire player
    ```
  - Youth academy: players with `youthStrength > 60` have 10% chance of producing a "wonderkid" (calidad = 75+)

**Test strategy:**
- Test: young players tend to improve
- Test: old players tend to decline
- Test: retired players are removed from teams
- Property test: total player count is stable over 10 seasons (births ≈ retirements)

**Dependencies:** None.

#### 3c. Cross-Federation Dynamics (`engine.ts`, `types.ts`, `negotiation.ts`)

**Files to modify:**
- `types.ts`:
  - Add `GlobalRanking` interface: `{ federationId: number; rank: number; avgStrength: number; prestige: number }`
  - Add `globalRankings: GlobalRanking[]` to `GameState`
  - Add `Friendly` interface: `{ id: number; homeTeamId: number; awayTeamId: number; year: number; result?: MatchResult }`
- `engine.ts`:
  - Add `computeGlobalRanking(s)` called from `closeSeason()`:
    - For each federation, compute avg team strength × number of teams × 0.4 + prestige × 0.6
    - Sort, assign ranks
    - Top federation gets +2 prestige bonus
  - Store in `s.globalRankings`
- `negotiation.ts`:
  - Add `arrangeFriendly(prev, homeTeamId, awayTeamId)` — simulate a cross-federation match, result affects both teams' prestige slightly (+1 winner, -1 loser)

**Test strategy:**
- Test: rankings are computed correctly
- Test: top federation gets prestige bonus
- Test: friendly results affect prestige

**Dependencies:** None.

---

### Release 4: Polish (Week 10-12)

**Goal:** Economy depth, narrative refinement, UI polish.

#### 4a. Economy Depth (`economy.ts`, `types.ts`, `engine.ts`)

**Files to modify:**
- `types.ts`:
  - Add `matchdayRevenue: number` to `LastEconomy`
  - Add `merchandiseRevenue: number` to `LastEconomy`
  - Add `youthBudget: number` to `EconomyPolicy` (line 255)
- `economy.ts`:
  - In `processEconomy()`: add matchday revenue calculation (per home match × attendance capacity × ticket price)
  - Add merchandise revenue (scales with league-wide prestige × number of teams)
  - Add youth budget → affects `talentBump` calculation
- `engine.ts`:
  - Wire youth budget into `processEconomy()` return value

**Test strategy:**
- Test: matchday revenue > 0 with competing teams
- Test: merchandise scales with prestige
- Test: youth budget affects talent bump

**Dependencies:** None.

#### 4b. Matchday Revenue Detail

**Files to modify:**
- `types.ts`: add `attendance: number` and `ticketPrice: number` to GameState
- `economy.ts`: compute per-match revenue in `processEconomy()`
- `engine.ts`: no changes needed

**Test strategy:**
- Property test: total matchday revenue ≈ matches × capacity × price

**Dependencies:** 4a.

---

## Appendix: File Change Summary

| File | Proposals | Est. New LOC | Est. Modified LOC |
|------|-----------|-------------|-------------------|
| `types.ts` | 1-10 | ~180 | ~50 |
| `engine.ts` | 1,2,3,4,7,9 | ~350 | ~80 |
| `match.ts` | 8 | ~40 | ~30 |
| `transfers.ts` | 3 | ~100 | ~60 |
| `events.ts` | 5 | ~120 | ~40 |
| `norms.ts` | 6 | ~50 | ~30 |
| `cups.ts` | 10 | ~100 | ~40 |
| `awards.ts` | 8 | ~30 | ~20 |
| `economy.ts` | 9,4a | ~80 | ~40 |
| `negotiation.ts` | 2,7 | ~120 | ~20 |
| `salaries.ts` | (indirect) | 0 | ~10 |
| `structure.ts` | (none) | 0 | 0 |
| `fixtures.ts` | (none) | 0 | 0 |
| `rng.ts` | (none) | 0 | 0 |
| `index.ts` | (none) | 0 | ~5 |
| **TOTAL** | | **~1,170** | **~425** |

---

*End of report.*
