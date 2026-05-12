import { BlackjackTable } from '../../game/blackjackTable/BlackjackTable';
import { BeatTheHouseGame } from '../../game/engine/BeatTheHouseGame';
import { SlotsGame } from '../../game/slots/SlotsGame';

export type GameModel =
  | { readonly kind: 'beat-the-house'; readonly game: BeatTheHouseGame }
  | { readonly kind: 'blackjack'; readonly table: BlackjackTable; settledSessionIds: Set<string> }
  | {
      readonly kind: 'slots';
      readonly game: SlotsGame;
      wagersByProfileId: Map<string, number>;
      readyProfileIds: Set<string>;
      lastSpinByProfileId?: string;
      returnedByProfileId: Map<string, number>;
      settledSpinKeys: Set<string>;
    };
