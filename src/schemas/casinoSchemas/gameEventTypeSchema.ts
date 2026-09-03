import { z } from 'zod';

export const gameEventTypeSchema = z.enum([
  'bet-placed',
  'dealer-tip-placed',
  'dealer-tip-taken',
  'bets-cleared',
  'shoe-shuffled',
  'shoe-cut-reached',
  'round-started',
  'player-card',
  'dealer-hole',
  'dealer-card',
  'hand-completed',
  'round-settled',
  'message',
]);
