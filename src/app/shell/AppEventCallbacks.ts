import type { CasinoGameId } from '../../game/ids';
import type { BeatAction } from './BeatAction';

export interface AppEventCallbacks {
  readonly createProfile: () => void;
  readonly startSelectedProfiles: () => void;
  readonly refreshMultiplayerRooms: () => void;
  readonly hostMultiplayerRoom: () => void;
  readonly leaveMultiplayerRoom: () => void;
  readonly backToLobby: () => void;
  readonly switchProfiles: () => void;
  readonly updateSessionLimit: () => void;
  readonly openRoomLobby: (gameId: CasinoGameId) => void;
  readonly selectChip: (button: HTMLButtonElement) => void;
  readonly dropChipOnTable: (event: DragEvent) => void;
  readonly runBeatAction: (action: BeatAction) => void;
  readonly addMoney: () => void;
  readonly subtractMoney: () => void;
  readonly resetMoney: () => void;
  readonly authorizeAdmin: () => void;
  readonly resetAllProfiles: () => void;
  readonly clearSaves: () => void;
  readonly toggleLayoutOverlay: () => void;
  readonly dealBlackjack: () => void;
  readonly hitBlackjack: () => void;
  readonly standBlackjack: () => void;
  readonly doubleBlackjack: () => void;
  readonly splitBlackjack: () => void;
  readonly insureBlackjack: () => void;
  readonly newBlackjackHand: () => void;
  readonly setSlotsWager: () => void;
  readonly readySlots: () => void;
  readonly spinSlots: () => void;
  readonly pickSlotsBonus: () => void;
}
