import { useMemo, useReducer, useState } from 'react';
import {
  advanceMatchday,
  advanceSeason,
  applyImpulse,
  closeAndStartNextSeason,
  computeStandings,
  createGame,
  tierOf,
  type Fixture,
  type GameState,
} from './engine';

type Action =
  | { type: 'matchday' }
  | { type: 'season' }
  | { type: 'next' }
  | { type: 'skip5' }
  | { type: 'impulse'; fixture: Fixture; favoredTeamId: number }
  | { type: 'newGame'; seed: number };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'matchday':
      return advanceMatchday(state);
    case 'season':
      return advanceSeason(state);
    case 'next':
      return closeAndStartNextSeason(state);
    case 'skip5': {
      let s = state;
      for (let i = 0; i < 5; i++) {
        s = closeAndStartNextSeason(advanceSeason(s));
      }
      return s;
    }
    case 'impulse':
      return applyImpulse(state, action.fixture, action.favoredTeamId);
    case 'newGame':
      return createGame(action.seed);
  }
}

const DEFAULT_SEED = 12345;

export function App() {
  const [seedInput, setSeedInput] = useState(String(DEFAULT_SEED));
  const [state, dispatch] = useReducer(reducer, DEFAULT_SEED, createGame);

  const standings = useMemo(
    () => computeStandings(state.teams, state.results),
    [state.teams, state.results],
  );

  const nameOf = (id: number) => state.teams.find((t) => t.id === id)?.name ?? '?';
  const strengthOf = (id: number) => state.teams.find((t) => t.id === id)?.strength ?? 0;

  const nextFixtures = state.fixtures.filter((f) => f.matchday === state.currentMatchday);
  const lastPlayed = state.currentMatchday - 1;
  const lastResults = state.results.filter((r) => r.matchday === lastPlayed);

  const impulseFor = (f: Fixture) =>
    state.pendingImpulses.find(
      (p) => p.matchday === f.matchday && p.homeId === f.homeId && p.awayId === f.awayId,
    );

  const recent = [...state.history].slice(-12).reverse();

  return (
    <div className="app">
      <div className="topbar">
        <h1>FOOTBALL GM</h1>
        <div className="stat">
          <span className="label">Temporada</span>
          <span className="value">{state.year}</span>
        </div>
        <div className="stat">
          <span className="label">Prestigio</span>
          <span className="value">
            {state.prestige} <span className="tier">· Tier {tierOf(state.prestige)}</span>
          </span>
        </div>
        <div className="stat">
          <span className="label">Impulsos</span>
          <span className="value">
            {state.impulsesRemaining}/{state.impulsesPerSeason}
          </span>
        </div>
        <div className="stat">
          <span className="label">Jornada</span>
          <span className="value">
            {Math.min(state.currentMatchday, state.totalMatchdays)}/{state.totalMatchdays}
          </span>
        </div>
        <div className="seed-row">
          <span className="muted">semilla</span>
          <input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value.replace(/[^0-9]/g, ''))}
          />
          <button
            className="btn"
            onClick={() =>
              dispatch({ type: 'newGame', seed: Number(seedInput) || DEFAULT_SEED })
            }
          >
            Nueva partida
          </button>
        </div>
      </div>

      <div className="layout">
        <div>
          <div className="panel">
            <h2>Clasificación · Temporada {state.year}</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Equipo</th>
                  <th>Fza</th>
                  <th>PJ</th>
                  <th>G</th>
                  <th>E</th>
                  <th>P</th>
                  <th>GF</th>
                  <th>GC</th>
                  <th>DG</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.teamId} className={i === 0 ? 'champion' : ''}>
                    <td>{i + 1}</td>
                    <td>{row.name}</td>
                    <td className="muted">{strengthOf(row.teamId)}</td>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.drawn}</td>
                    <td>{row.lost}</td>
                    <td>{row.goalsFor}</td>
                    <td>{row.goalsAgainst}</td>
                    <td>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                    <td>
                      <strong>{row.points}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lastResults.length > 0 && (
            <div className="panel">
              <h2>Resultados · Jornada {lastPlayed}</h2>
              {lastResults.map((r, i) => (
                <div className="result-line" key={i}>
                  <span>{nameOf(r.homeId)}</span>
                  <strong>
                    {r.homeGoals} – {r.awayGoals}
                  </strong>
                  <span>{nameOf(r.awayId)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {state.seasonOver ? (
            <div className="panel">
              <h2>Fin de temporada {state.history.at(-1)?.year ?? state.year}</h2>
              <div className="season-summary">
                <div className="muted">Campeón</div>
                <div className="champ">{standings[0]?.name}</div>
                <div className="muted">{standings[0]?.points} puntos</div>
                <p>
                  Prestigio {state.prestige} → ¿?{' '}
                  <span className="muted">(se confirma al cerrar)</span>
                </p>
                <button
                  className="btn primary"
                  onClick={() => dispatch({ type: 'next' })}
                >
                  Cerrar y empezar temporada {state.year + 1}
                </button>
              </div>
            </div>
          ) : (
            <div className="panel">
              <h2>Próxima jornada · {state.currentMatchday}</h2>
              {nextFixtures.map((f, i) => {
                const imp = impulseFor(f);
                return (
                  <div className="fixture" key={i}>
                    <span className="teams">
                      {nameOf(f.homeId)}{' '}
                      <span className="muted">v</span> {nameOf(f.awayId)}
                    </span>
                    <span className="imp">
                      <button
                        className={`chip ${imp?.favoredTeamId === f.homeId ? 'active' : ''}`}
                        disabled={
                          (state.impulsesRemaining <= 0 && !imp) ||
                          (!!imp && imp.favoredTeamId !== f.homeId)
                        }
                        onClick={() =>
                          dispatch({ type: 'impulse', fixture: f, favoredTeamId: f.homeId })
                        }
                      >
                        ⚑ local
                      </button>
                      <button
                        className={`chip ${imp?.favoredTeamId === f.awayId ? 'active' : ''}`}
                        disabled={
                          (state.impulsesRemaining <= 0 && !imp) ||
                          (!!imp && imp.favoredTeamId !== f.awayId)
                        }
                        onClick={() =>
                          dispatch({ type: 'impulse', fixture: f, favoredTeamId: f.awayId })
                        }
                      >
                        ⚑ visit.
                      </button>
                    </span>
                  </div>
                );
              })}
              <div className="btn-row">
                <button className="btn" onClick={() => dispatch({ type: 'matchday' })}>
                  Avanzar jornada
                </button>
                <button
                  className="btn primary"
                  onClick={() => dispatch({ type: 'season' })}
                >
                  Avanzar temporada
                </button>
                <button className="btn" onClick={() => dispatch({ type: 'skip5' })}>
                  Saltar 5 temporadas
                </button>
              </div>
            </div>
          )}

          <div className="panel">
            <h2>Historial</h2>
            {recent.length === 0 ? (
              <p className="muted">Aún no se ha cerrado ninguna temporada.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Año</th>
                    <th>Campeón</th>
                    <th>Pts</th>
                    <th>Prestigio</th>
                    <th>Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((h) => (
                    <tr key={h.year}>
                      <td>{h.year}</td>
                      <td>{h.championName}</td>
                      <td>{h.points}</td>
                      <td>
                        {h.prestigeBefore} → {h.prestigeAfter}
                      </td>
                      <td className={h.delta >= 0 ? 'delta-up' : 'delta-down'}>
                        {h.delta >= 0 ? `+${h.delta}` : h.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
