import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createGame,
  startSeason,
} from '../src/index';

// Golden master: locks the simulation output for a fixed seed. If engine logic
// changes the numbers, this fails on purpose — review the diff before updating.
describe('golden master (seed 777)', () => {
  it('produces a stable 6-season history', () => {
    let g = createGame(777);
    for (let i = 0; i < 6; i++) g = closeSeason(advanceSeason(startSeason(g)));
    expect(g.history).toMatchSnapshot();
  });
});
