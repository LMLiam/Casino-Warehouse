export type BeatAction = 'clear-bets' | 'rebet' | 'start-round' | 'next-round' | { readonly type: 'player-action'; readonly action: 'hit' | 'stick' };
