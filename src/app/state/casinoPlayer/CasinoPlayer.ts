import { BlackjackGame } from '../../../game/blackjack/BlackjackGame';
import { BeatTheHouseGame } from '../../../game/engine/BeatTheHouseGame';
import { SlotsGame } from '../../../game/slots/SlotsGame';

export interface CasinoPlayer {
  readonly profileId: string;
  readonly name: string;
  readonly beatTheHouse: BeatTheHouseGame;
  readonly blackjack: BlackjackGame;
  readonly slots: Readonly<Record<string, SlotsGame>>;
}
