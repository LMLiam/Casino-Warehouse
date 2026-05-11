import { BlackjackGame } from '../../game/blackjack';
import { slotThemes } from '../../game/catalog';
import { BeatTheHouseGame } from '../../game/engine';
import { SlotsGame } from '../../game/slots';
import type { CasinoProfile } from '../../state/profiles';
import type { PlayerGameSnapshots } from '../../state/session';

export interface CasinoPlayer {
  readonly profileId: string;
  readonly name: string;
  readonly beatTheHouse: BeatTheHouseGame;
  readonly blackjack: BlackjackGame;
  readonly slots: Readonly<Record<string, SlotsGame>>;
}

export const createPlayerFromProfile = (profile: CasinoProfile, snapshots?: PlayerGameSnapshots): CasinoPlayer => {
  const beatTheHouse = new BeatTheHouseGame({ initialBankroll: profile.bankroll });
  if (snapshots?.beatTheHouse) {
    beatTheHouse.restoreState(snapshots.beatTheHouse);
    beatTheHouse.syncBankroll(profile.bankroll);
  }

  const blackjack = new BlackjackGame();
  if (snapshots?.blackjack) {
    blackjack.restore(snapshots.blackjack);
  }

  const slots = Object.fromEntries(
    slotThemes.map((theme) => {
      const game = new SlotsGame({ theme });
      const snapshot = snapshots?.slots?.[theme.id];
      if (snapshot) {
        game.restore(snapshot);
      }
      return [theme.id, game];
    }),
  ) as Readonly<Record<string, SlotsGame>>;

  return {
    profileId: profile.id,
    name: profile.name,
    beatTheHouse,
    blackjack,
    slots,
  };
};
