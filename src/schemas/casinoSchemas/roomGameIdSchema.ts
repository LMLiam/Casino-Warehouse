import { z } from 'zod';
import type { CasinoGameId } from '../../game/ids';

export const roomGameIdSchema = z.custom<CasinoGameId>(
  (value) => typeof value === 'string' && (value === 'beat-the-house' || value === 'blackjack' || value === 'slots:thai-princess'),
  {
    message: 'Game id is invalid.',
  },
);
