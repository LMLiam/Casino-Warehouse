import { isBlackjackTableSnapshot } from '../../game/blackjackTable/isBlackjackTableSnapshot';
import { findGame } from '../../game/catalog/findGame';
import type { CasinoGameId } from '../../game/ids';
import { SlotsGame } from '../../game/slots/SlotsGame';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { MultiplayerClient } from '../../multiplayer/client/MultiplayerClient';
import type { RealtimeConnectionState } from '../../multiplayer/client/RealtimeConnectionState';
import type { RoomRole } from '../../multiplayer/protocol/RoomRole';
import type { RoomSeatId } from '../../multiplayer/protocol/RoomSeatId';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import type { RoomSummary } from '../../multiplayer/protocol/RoomSummary';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import { PixiTable } from '../../ui/PixiTable/PixiTable';
import type { PixiTableSettlementMetadata } from '../../ui/PixiTable/PixiTableSettlementMetadata';
import type { CasinoProfile } from '../../state/profiles/CasinoProfile';
import type { CasinoSaveState } from '../../state/profiles/CasinoSaveState';
import type { CasinoPlayer } from '../state/casinoPlayer/CasinoPlayer';
import { isBeatSnapshot } from '../state/appSnapshots/isBeatSnapshot';
import { isSlotSnapshot } from '../state/appSnapshots/isSlotSnapshot';
import type { AppElements } from '../dom/appElements/AppElements';
import { money } from '../format/appMoney';
import { BeatControlsView } from '../views/BeatControlsView';
import { BeatSeatStatusView } from '../views/BeatSeatStatusView';
import { BlackjackView } from '../views/BlackjackView';
import { GameLobbyView } from '../views/GameLobbyView';
import { PlayerStripView } from '../views/PlayerStripView';
import { ProfileSetupView } from '../views/ProfileSetupView';
import { RoomBrowserView } from '../views/RoomBrowserView';
import { RoomSeatsView } from '../views/RoomSeatsView';
import { RulesMenuView } from '../views/RulesMenuView';
import { SlotsView } from '../views/SlotsView';
import { WalletView } from '../views/WalletView';

export abstract class GameAppRendering {
  protected abstract readonly table: PixiTable;
  protected abstract readonly elements: AppElements;
  protected abstract readonly beatControlsView: BeatControlsView;
  protected abstract readonly beatSeatStatusView: BeatSeatStatusView;
  protected abstract readonly blackjackView: BlackjackView;
  protected abstract readonly gameLobbyView: GameLobbyView;
  protected abstract readonly playerStripView: PlayerStripView;
  protected abstract readonly profileSetupView: ProfileSetupView;
  protected abstract readonly roomBrowserView: RoomBrowserView;
  protected abstract readonly roomSeatsView: RoomSeatsView;
  protected abstract readonly rulesMenuView: RulesMenuView;
  protected abstract readonly slotsView: SlotsView;
  protected abstract readonly walletView: WalletView;
  protected abstract readonly multiplayer: MultiplayerClient;
  protected abstract player: CasinoPlayer | undefined;
  protected abstract profileState: CasinoSaveState;
  protected abstract lastSaveError: string;
  protected abstract activeGame: CasinoGameId;
  protected abstract showingGameLobby: boolean;
  protected abstract sessionWagerLimit: number;
  protected abstract sessionWagered: number;
  protected abstract multiplayerRooms: readonly RoomSummary[];
  protected abstract connectionState: RealtimeConnectionState;
  protected abstract readonly ownedProfileIds: Set<ProfileId>;
  protected abstract profileAccessReceived: boolean;
  protected abstract get currentPlayer(): CasinoPlayer | undefined;

  protected abstract currentProfile(): CasinoProfile | undefined;
  protected abstract currentSlots(): SlotsGame;
  protected abstract activeRoomForGame(): RoomSnapshot | undefined;
  protected abstract beatSettlementMetadataFor(room: RoomSnapshot | undefined, profileId: ProfileId | undefined): readonly PixiTableSettlementMetadata[];
  protected abstract claimRoomSeat(seatId: RoomSeatId): void;
  protected abstract joinMultiplayerRoom(roomId: RoomId, role: RoomRole): void;
  protected abstract openRoomLobby(gameId: CasinoGameId): void;
  protected abstract saveSession(): void;
  protected abstract canUseServer(): boolean;

  protected renderMultiplayerRoom(): void {
    const room = this.multiplayer.room;
    if (!room) {
      this.roomSeatsView.clear();
      this.beatControlsView.clearPending();
      this.beatSeatStatusView.clear();
      return;
    }
    this.roomSeatsView.render(room, this.currentPlayer?.profileId, (seatId) => this.claimRoomSeat(seatId));
    if (room.gameId === 'beat-the-house' && isBeatSnapshot(room.game)) {
      const profileId = this.currentPlayer?.profileId;
      const roomMember =
        room.players.find((candidate) => candidate.profileId === profileId) ?? room.spectators.find((candidate) => candidate.profileId === profileId);
      const controlsAvailable = Boolean(profileId && room.seats.some((seat) => seat.profileId === profileId));
      this.table.render(room.game, this.beatSettlementMetadataFor(room, this.currentPlayer?.profileId));
      this.renderBeatControls(room.game, controlsAvailable, room, profileId, roomMember?.bankroll, true);
    }
    this.renderRoomBrowser();
  }

  protected renderRoomBrowser(): void {
    this.roomBrowserView.render(this.activeGame, this.multiplayerRooms, (roomId, role) => this.joinMultiplayerRoom(roomId, role));
  }

  protected renderProfileSetup(): void {
    this.profileSetupView.render(
      this.profileState,
      this.lastSaveError,
      this.ownedProfileIds,
      (profileId, nextName) => {
        if (this.canUseServer()) {
          this.multiplayer.renameProfile(profileId, nextName);
        }
      },
      (profileId) => {
        if (this.canUseServer()) {
          this.multiplayer.deleteProfile(profileId);
        }
      },
    );
  }

  protected renderPlayerProfile(): void {
    this.playerStripView.render(this.player);
  }

  protected renderCasino(): void {
    const player = this.currentPlayer;
    if (!player) {
      this.walletView.clear();
      this.elements.beatSettlementAnnouncement.textContent = '';
      return;
    }

    this.elements.gameTabs.forEach((button) => button.classList.toggle('selected', button.dataset.game === this.activeGame));

    const activeCatalogGame = findGame(this.activeGame);
    const isBeatTheHouse = activeCatalogGame.kind === 'beat-the-house';
    const isBlackjack = activeCatalogGame.kind === 'blackjack';
    const isSlots = activeCatalogGame.kind === 'slots';
    const activeRoom = this.activeRoomForGame();
    const roomPlayer = activeRoom?.players.find((candidate) => candidate.profileId === player.profileId);
    const roomMember = roomPlayer ?? activeRoom?.spectators.find((candidate) => candidate.profileId === player.profileId);
    const hasActiveRoomSeat = Boolean(activeRoom?.seats.some((seat) => seat.profileId === player.profileId));
    const canUseGameControls = !activeRoom || hasActiveRoomSeat;
    const beatSnapshot = isBeatTheHouse && activeRoom && isBeatSnapshot(activeRoom.game) ? activeRoom.game : player.beatTheHouse.snapshot();
    const beatBankroll = roomMember?.bankroll ?? this.currentProfile()?.bankroll ?? beatSnapshot.bankroll;
    const blackjackSnapshot = isBlackjack && activeRoom && isBlackjackTableSnapshot(activeRoom.game) ? activeRoom.game : player.blackjack.snapshot();
    const slotsSnapshot = isSlots && activeRoom && isSlotSnapshot(activeRoom.game) ? activeRoom.game : this.currentSlots().snapshot();
    const showingRoomLobby = !this.showingGameLobby && !activeRoom;
    this.elements.gameLobby.classList.toggle('hidden', !this.showingGameLobby);
    this.elements.roomLobby.classList.toggle('hidden', !showingRoomLobby);
    this.elements.tableHost.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !isBeatTheHouse);
    this.elements.blackjackView.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !isBlackjack);
    this.elements.slotsView.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !isSlots);
    this.elements.beatControls.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !isBeatTheHouse || !canUseGameControls);
    this.elements.blackjackControls.classList.toggle(
      'hidden',
      this.showingGameLobby || showingRoomLobby || this.activeGame !== 'blackjack' || !canUseGameControls,
    );
    this.elements.slotsControls.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !isSlots || !canUseGameControls);
    this.elements.gameHud.classList.remove('hidden');
    this.elements.moneyPill.classList.toggle('hidden', showingRoomLobby);
    this.elements.actionDock.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !canUseGameControls);
    this.elements.backToLobbyButton.disabled = this.showingGameLobby;
    this.elements.leaveRoomButton.classList.toggle('hidden', !activeRoom);
    this.elements.roomMenu.classList.toggle('hidden', !activeRoom);
    if (!activeRoom) {
      this.elements.roomMenu.open = false;
    }
    this.elements.chipRail.classList.toggle(
      'hidden',
      this.showingGameLobby || showingRoomLobby || !isBeatTheHouse || beatSnapshot.phase !== 'betting' || !canUseGameControls,
    );

    if (isBeatTheHouse) {
      this.table.resize();
    }
    this.table.render(beatSnapshot, this.beatSettlementMetadataFor(activeRoom, player.profileId));
    this.beatSeatStatusView.render(beatSnapshot, isBeatTheHouse ? activeRoom : undefined, player.profileId, (seatId) => this.claimRoomSeat(seatId));
    const showBeatHalfChip = isBeatTheHouse && !this.showingGameLobby && !showingRoomLobby;
    this.renderWallet(beatSnapshot, roomMember?.bankroll, showBeatHalfChip);
    this.renderBeatControls(beatSnapshot, canUseGameControls, activeRoom, player.profileId, beatBankroll);
    this.blackjackView.render(blackjackSnapshot, player.profileId);
    this.slotsView.render(slotsSnapshot, this.activeGame, activeRoom, player.profileId);
    this.renderRoomBrowser();
    this.rulesMenuView.render(activeCatalogGame);
    this.renderSessionLimit();
  }

  protected renderGameLobby(): void {
    this.gameLobbyView.render(this.currentProfile(), (gameId) => this.openRoomLobby(gameId));
  }

  protected renderBeatControls(
    snapshot: GameSnapshot,
    controlsAvailable = true,
    activeRoom?: RoomSnapshot,
    profileId?: ProfileId,
    bankroll?: number,
    isBeatTheHouse = findGame(this.activeGame).kind === 'beat-the-house',
  ): void {
    this.beatControlsView.render(
      snapshot,
      isBeatTheHouse,
      () => this.multiplayer.send({ type: 'start-round' }),
      controlsAvailable,
      activeRoom,
      profileId,
      bankroll,
    );
  }

  protected renderWallet(snapshot: GameSnapshot, bankrollOverride?: number, showBeatHalfChip = false): void {
    this.walletView.render(snapshot, this.currentProfile(), bankrollOverride, showBeatHalfChip);
  }

  protected renderConnectionState(): void {
    const blocking = this.connectionState === 'connecting' || this.connectionState === 'reconnecting' || this.connectionState === 'disconnected';
    this.elements.connectionOverlay.classList.toggle('hidden', !blocking);
  }

  protected renderSessionLimit(): void {
    const limitText = this.sessionWagerLimit > 0 ? ` / ${money(this.sessionWagerLimit)}` : ' / no limit';
    this.elements.sessionNotice.textContent = `Session wagered ${money(this.sessionWagered)}${limitText}. Fictional currency only.`;
  }
}
