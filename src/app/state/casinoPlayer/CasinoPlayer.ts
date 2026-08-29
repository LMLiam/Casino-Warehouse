import { BlackjackGame } from '../../../game/blackjack/BlackjackGame';
import { BeatTheHouseGame } from '../../../game/engine/BeatTheHouseGame';
import { SlotsGame } from '../../../game/slots/SlotsGame';
import type { ProfileId } from '../../../schemas/casinoSchemas/ProfileId';
import type { SlotThemeId } from '../../../schemas/casinoSchemas/SlotThemeId';

export interface CasinoPlayer {
  readonly profileId: ProfileId;
  readonly name: string;
  readonly beatTheHouse: BeatTheHouseGame;
  readonly blackjack: BlackjackGame;
  readonly slots: ReadonlyMap<SlotThemeId, SlotsGame>;
}
