import type { CasinoAudio } from '../../audio/casinoAudio/CasinoAudio';
import { findGame } from '../../game/catalog/findGame';
import type { CasinoGameId } from '../../game/ids';
import { defaultRealtimeUrl } from '../../multiplayer/client/defaultRealtimeUrl';
import type { RoomRole } from '../../multiplayer/protocol/RoomRole';
import type { RoomSeatId } from '../../multiplayer/protocol/RoomSeatId';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import { normalizeRoomMaxPlayers } from '../../multiplayer/roomLimits/normalizeRoomMaxPlayers';
import { readCreditInput } from '../input/appInputs/readCreditInput';
import { readPositiveCreditInput } from '../input/appInputs/readPositiveCreditInput';
import { hitTestBetZone } from '../input/betZoneHitTest';
import { defaultRoomMaxPlayers } from '../rooms/roomDefaults';
import { isBeatSnapshot } from '../state/appSnapshots/isBeatSnapshot';
import type { BeatChipSelection } from './BeatChipSelection';
import type { BeatAction } from './BeatAction';
import { GameAppSession } from './GameAppSession';

export abstract class GameAppRoomActions extends GameAppSession {
  protected abstract readonly audio: CasinoAudio;
  protected abstract readonly beatChipSelection: BeatChipSelection;

  protected runBeatAction(action: BeatAction): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()) {
      if (action === 'start-round' && this.beatControlsView.shouldQueueStartRound(this.activeRoomForGame())) {
        this.beatControlsView.queueStartRound();
        return;
      }
      this.multiplayer.send(typeof action === 'string' ? { type: action } : { type: action.type, action: action.action });
      return;
    }
    this.showRoomRequiredMessage();
  }

  protected selectChip(button: HTMLButtonElement): void {
    this.beatChipSelection.select(button);
  }

  protected dropChipOnTable(event: DragEvent): void {
    event.preventDefault();
    const amount = Math.floor(Number(event.dataTransfer?.getData('text/plain') || 0));
    const target = hitTestBetZone(this.elements.tableHost, event.clientX, event.clientY);
    if (!target || amount <= 0 || !this.currentPlayer) {
      return;
    }
    if (!this.canUseServer()) {
      return;
    }
    if (!this.beatChipSelection.ensureAmountAffordable(amount)) {
      return;
    }
    const activeRoom = this.activeRoomForGame();
    if ('betType' in target && target.betType !== 'main' && activeRoom && isBeatSnapshot(activeRoom.game) && activeRoom.game.bets[target.handId].main <= 0) {
      return;
    }
    if (activeRoom) {
      if ('dealerTip' in target) {
        this.multiplayer.send({ type: 'place-tip', seatId: target.handId, amount });
        this.beatControlsView.markPendingBet('dealerTip');
      } else {
        this.multiplayer.send({ type: 'place-chip', seatId: target.handId, betType: target.betType, amount });
        this.beatControlsView.markPendingBet(target.betType);
      }
    }
    this.audio.play('chip');
  }

  protected showRoomRequiredMessage(): void {
    this.elements.roomStatus.textContent = 'Choose or create a multiplayer room before playing.';
  }

  protected hostMultiplayerRoom(): void {
    const profile = this.currentProfile();
    if (!profile) {
      this.elements.roomStatus.textContent = 'Start a profile session before hosting a room.';
      return;
    }
    if (!this.canUseServer()) {
      return;
    }
    const gameId = this.activeGame;
    const roomName = this.elements.roomNameInput.value.trim() || `${findGame(gameId).title} Room`;
    const maxPlayers = normalizeRoomMaxPlayers(gameId, readCreditInput(this.elements.roomMaxPlayersInput, defaultRoomMaxPlayers(gameId)));
    this.elements.roomMaxPlayersInput.value = String(maxPlayers);
    this.ensureRealtimeConnected();
    this.multiplayer.createRoom(gameId, roomName, maxPlayers, profile.id, profile.name, profile.bankroll);
  }

  protected joinMultiplayerRoom(roomId: RoomId, role: RoomRole = 'player'): void {
    const profile = this.currentProfile();
    if (!profile || !roomId) {
      this.elements.roomStatus.textContent = 'Select a profile and choose a room first.';
      return;
    }
    if (!this.canUseServer()) {
      return;
    }
    const gameId = this.activeGame;
    this.ensureRealtimeConnected();
    this.multiplayer.joinRoom(gameId, roomId, role, profile.id, profile.name, profile.bankroll);
  }

  protected claimRoomSeat(seatId: RoomSeatId): void {
    if (!this.canUseServer()) {
      return;
    }
    if (!this.activeRoomForGame()) {
      this.elements.roomStatus.textContent = 'Join a room before choosing a seat.';
      return;
    }
    this.multiplayer.send({ type: 'assign-seat', seatId });
  }

  protected leaveMultiplayerRoom(): void {
    if (!this.canUseServer()) {
      return;
    }
    this.multiplayer.leaveRoom();
    this.elements.roomStatus.textContent = 'Left room. No active game room is connected.';
    this.roomSeatsView.clear();
    this.beatControlsView.clearPending();
    this.beatSeatStatusView.clear();
    this.refreshMultiplayerRooms();
    this.saveSession();
    this.renderCasino();
  }

  protected goHome(): void {
    if (this.activeRoomForGame() && this.multiplayer.connected) {
      this.multiplayer.leaveRoom();
      this.roomSeatsView.clear();
      this.beatControlsView.clearPending();
      this.beatSeatStatusView.clear();
    }
    this.showingGameLobby = true;
    this.elements.roomStatus.textContent = 'Choose a game to browse live rooms.';
    this.saveSession();
    this.renderCasino();
  }

  protected switchProfiles(): void {
    if (this.multiplayer.room && this.multiplayer.connected) {
      this.multiplayer.leaveRoom();
    }
    this.player = undefined;
    this.activeGame = 'beat-the-house';
    this.showingGameLobby = true;
    this.sessionWagered = 0;
    this.sessionWagerLimit = 0;
    this.pendingRoomRestore = undefined;
    this.returnHomeOnServerResync = false;
    this.restoringRoomAfterReconnect = false;
    this.multiplayerRooms = [];
    this.clearClientSession();
    this.profileSetupView.clearSelection();
    this.roomSeatsView.clear();
    this.beatControlsView.clearPending();
    this.beatSeatStatusView.clear();
    this.multiplayer.clearRoomState();
    this.elements.shell.classList.add('hidden');
    this.elements.setup.classList.remove('hidden');
    this.renderProfileSetup();
  }

  protected refreshMultiplayerRooms(): void {
    if (!this.canUseServer()) {
      return;
    }
    this.ensureRealtimeConnected();
    this.multiplayer.listRooms(this.activeGame);
  }

  protected ensureRealtimeConnected(): void {
    if (this.multiplayer.connected || this.connectionState === 'connecting' || this.connectionState === 'reconnecting') {
      return;
    }
    if (this.realtimeUrlError) {
      this.connectionState = 'disconnected';
      this.elements.roomStatus.textContent = this.realtimeUrlError;
      this.renderConnectionState();
      return;
    }
    this.multiplayer.connect(this.realtimeUrl || defaultRealtimeUrl());
  }

  protected openRoomLobby(gameId: CasinoGameId): void {
    this.activeGame = gameId;
    this.showingGameLobby = false;
    this.multiplayerRooms = [];
    this.elements.roomStatus.textContent = `Browsing ${findGame(gameId).title} rooms.`;
    this.saveSession();
    this.renderCasino();
    this.refreshMultiplayerRooms();
  }

  protected dealBlackjack(): void {
    const player = this.currentPlayer;
    if (!player) {
      return;
    }
    if (!this.canUseServer()) {
      return;
    }

    const wager = readPositiveCreditInput(this.elements.blackjackWager);
    if (this.activeRoomForGame()?.gameId === 'blackjack') {
      this.multiplayer.send({ type: 'blackjack-deal', wager });
      this.audio.play('deal');
      return;
    }
    this.showRoomRequiredMessage();
  }

  protected sendBlackjackAction(action: 'hit' | 'stand' | 'double' | 'split' | 'insurance' | 'new-hand'): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId === 'blackjack') {
      this.multiplayer.send({ type: 'blackjack-action', action });
      return;
    }
    this.showRoomRequiredMessage();
  }

  protected spinSlots(): void {
    const player = this.currentPlayer;
    if (!player) {
      return;
    }
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId === this.activeGame) {
      this.slotsView.playSpinAnimation();
      this.multiplayer.send({ type: 'slots-spin' });
      this.audio.play('spin');
      return;
    }
    this.showRoomRequiredMessage();
  }

  protected setMultiplayerSlotsWager(): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId !== this.activeGame) {
      return;
    }
    const wager = readPositiveCreditInput(this.elements.slotsWager);
    this.multiplayer.send({ type: 'slots-wager', wager });
  }

  protected readyMultiplayerSlots(): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId !== this.activeGame) {
      return;
    }
    this.multiplayer.send({ type: 'slots-ready', ready: true });
  }

  protected pickSlotsBonus(): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId === this.activeGame) {
      this.multiplayer.send({ type: 'slots-pick-bonus' });
      return;
    }
    this.showRoomRequiredMessage();
  }

  protected activeRoomForGame(): RoomSnapshot | undefined {
    return this.multiplayer.room?.gameId === this.activeGame ? this.multiplayer.room : undefined;
  }

  protected canUseServer(): boolean {
    if (this.multiplayer.connected) {
      return true;
    }
    this.connectionState = 'reconnecting';
    this.renderConnectionState();
    this.elements.roomStatus.textContent = 'Reconnecting to the server. Actions are paused.';
    return false;
  }
}
