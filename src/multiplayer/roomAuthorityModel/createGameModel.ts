import { BlackjackTable } from '../../game/blackjackTable/BlackjackTable';
import { findSlotTheme } from '../../game/catalog/findSlotTheme';
import { BeatTheHouseGame } from '../../game/engine/BeatTheHouseGame';
import { SlotsGame } from '../../game/slots/SlotsGame';
import type { RoomGameId } from '../protocol/RoomGameId';
import type { GameModel } from './GameModel';

export const createGameModel = (gameId: RoomGameId, bankroll: number): GameModel => {
  if (gameId === 'beat-the-house') {
    return { kind: 'beat-the-house', game: new BeatTheHouseGame({ initialBankroll: bankroll }) };
  }
  if (gameId === 'blackjack') {
    return { kind: 'blackjack', table: new BlackjackTable(), settledSessionIds: new Set() };
  }
  return {
    kind: 'slots',
    game: new SlotsGame({ theme: findSlotTheme(gameId) }),
    wagersByProfileId: new Map(),
    readyProfileIds: new Set(),
    returnedByProfileId: new Map(),
    settledSpinKeys: new Set(),
  };
};
