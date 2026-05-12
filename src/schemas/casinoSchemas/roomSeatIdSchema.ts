import { z } from 'zod';
import type { HandId } from '../../game/types/HandId';
import { handIds } from '../../game/types/handIds';
import type { ParsedRoomSeatId } from './ParsedRoomSeatId';

export const roomSeatIdSchema = z.custom<ParsedRoomSeatId>(
  (value) => handIds.includes(value as HandId) || (typeof value === 'string' && /^seat-[1-9]\d*$/.test(value)),
  {
    message: 'Seat id is invalid.',
  },
);
