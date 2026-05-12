import type { CasinoProfile } from './CasinoProfile';
import type { CasinoSaveState } from './CasinoSaveState';
import { createStateId } from './createStateId';
import { emptyStats } from './emptyStats';

type StateIdGenerator = (prefix: string, now: Date) => string;

export const createProfile = (
  state: CasinoSaveState,
  name: string,
  bankroll = 1000,
  now = new Date(),
  idGenerator: StateIdGenerator = createStateId,
): CasinoSaveState => {
  const profileName = normalizeName(name);
  const at = now.toISOString();
  const profile: CasinoProfile = {
    id: idGenerator('profile', now),
    name: profileName,
    color: colorFromName(profileName),
    bankroll: Math.max(0, Math.floor(bankroll)),
    stats: emptyStats(),
    transactions: [],
    createdAt: at,
    updatedAt: at,
  };

  return { ...state, profiles: [...state.profiles, profile] };
};

const normalizeName = (name: string): string => name.trim().slice(0, 32) || 'Player';

const colorFromName = (name: string): string => {
  const colors = ['#ffd56b', '#75ff92', '#26f0ff', '#ff8ac6', '#b48cff', '#ffb13b'];
  const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[total % colors.length];
};
