import { BlackjackTable } from '../../game/blackjackTable/BlackjackTable';
import { BeatTheHouseGame } from '../../game/engine/BeatTheHouseGame';
import { SlotsGame } from '../../game/slots/SlotsGame';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomReadyPhase } from '../protocol/RoomReadyPhase';

export type GameModel =
  | {
      readonly kind: 'beat-the-house';
      readonly game: BeatTheHouseGame;
      readyProfileIds: Set<ProfileId>;
      readyPhase?: RoomReadyPhase | undefined;
      nextRoundDeadlineAt?: number | undefined;
      nextRoundTimer?: ReturnType<typeof setTimeout> | undefined;
    }
  | { readonly kind: 'blackjack'; readonly table: BlackjackTable; settledSessionIds: Set<string> }
  | {
      readonly kind: 'slots';
      readonly game: SlotsGame;
      wagersByProfileId: Map<ProfileId, number>;
      readyProfileIds: Set<ProfileId>;
      lastSpinByProfileId?: ProfileId | undefined;
      returnedByProfileId: Map<ProfileId, number>;
      settledSpinKeys: Set<string>;
    };
