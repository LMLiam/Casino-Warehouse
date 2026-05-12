import type { CasinoSaveState } from './CasinoSaveState';

export const renameProfile = (state: CasinoSaveState, profileId: string, name: string, now = new Date()): CasinoSaveState => ({
  ...state,
  profiles: state.profiles.map((profile) => (profile.id === profileId ? { ...profile, name: normalizeName(name), updatedAt: now.toISOString() } : profile)),
});

const normalizeName = (name: string): string => name.trim().slice(0, 32) || 'Player';
