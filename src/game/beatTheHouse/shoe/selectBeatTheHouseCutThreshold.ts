import { beatTheHouseRules } from '../beatTheHouseRules';
import type { Rng } from '../../rng/Rng';
import { secureRandomInt } from '../../rng/secureRandomInt';

export const selectBeatTheHouseCutThreshold = (rng?: Rng): number => {
  const range = beatTheHouseRules.cutThreshold.maximum - beatTheHouseRules.cutThreshold.minimum + 1;
  const offset = rng ? Math.floor(rng() * range) : secureRandomInt(range);
  if (!Number.isInteger(offset) || offset < 0 || offset >= range) {
    throw new Error('Beat the House shoe RNG returned an invalid cut threshold value.');
  }
  return beatTheHouseRules.cutThreshold.minimum + offset;
};
