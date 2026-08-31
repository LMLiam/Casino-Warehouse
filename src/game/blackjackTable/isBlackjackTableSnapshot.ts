import type { BlackjackSnapshot } from '../blackjack/BlackjackSnapshot';
import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import type { SlotSnapshot } from '../slots/SlotSnapshot';
import type { GameSnapshot } from '../types/GameSnapshot';
import { blackjackTableSnapshotSchema } from '../../schemas/casinoSchemas/blackjackTableSnapshotSchema';
import type { BlackjackTableSnapshot } from './BlackjackTableSnapshot';

export const isBlackjackTableSnapshot = (
  snapshot: GameSnapshot | BlackjackSnapshot | BlackjackTableSnapshot | SlotSnapshot | JsonValue,
): snapshot is BlackjackTableSnapshot => blackjackTableSnapshotSchema.safeParse(snapshot).success;
