import { BlackjackGame } from '../../../game/blackjack/BlackjackGame';
import { slotThemes } from '../../../game/catalog/slotThemes';
import { BeatTheHouseGame } from '../../../game/engine/BeatTheHouseGame';
import { SlotsGame } from '../../../game/slots/SlotsGame';
import type { CasinoProfile } from '../../../state/profiles/CasinoProfile';
import type { PlayerGameSnapshots } from '../../../state/session/PlayerGameSnapshots';
import type { CasinoPlayer } from './CasinoPlayer';

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

  const slots = new Map(
    slotThemes.map((theme) => {
      const game = new SlotsGame({ theme });
      const snapshot = snapshots?.slots?.[theme.id];
      if (snapshot) {
        game.restore(snapshot);
      }
      return [theme.id, game];
    }),
  );

  return {
    profileId: profile.id,
    name: profile.name,
    beatTheHouse,
    blackjack,
    slots,
  };
};
