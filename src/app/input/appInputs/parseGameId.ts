import type { CasinoGameId } from '../../../game/ids';
import { roomGameIdSchema } from '../../../schemas/casinoSchemas/roomGameIdSchema';

export const parseGameId = (value: unknown): CasinoGameId | undefined => {
  const parsed = roomGameIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};
