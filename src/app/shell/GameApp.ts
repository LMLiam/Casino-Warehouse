import { Container, Texture } from 'pixi.js';
import { CasinoAudio } from '../../audio/casinoAudio';
import { findGame, type CasinoGameId } from '../../game/catalog';
import type { BetType, HandId } from '../../game/types';
import type { ChipValue } from '../../ui/chips';
import { PixiTable } from '../../ui/PixiTable';
import { mountRadixChrome } from '../../ui/radixChrome';
import { CardRenderer } from '../../ui/renderers/CardRenderer';
import { ChipRenderer } from '../../ui/renderers/ChipRenderer';
import { EffectRenderer } from '../../ui/renderers/EffectRenderer';
import { TagRenderer } from '../../ui/renderers/TagRenderer';
import type { CasinoProfile, CasinoSaveState } from '../../state/profiles';
import { type CasinoSessionRoomState } from '../../state/session';
import { defaultRealtimeUrl, MultiplayerClient, type RealtimeConnectionState } from '../../multiplayer/client';
import {
  protocolVersion,
  type RoomGameId,
  type RoomRole,
  type RoomSeatId,
  type RoomSettlement,
  type RoomSnapshot,
  type RoomSummary,
} from '../../multiplayer/protocol';
import { normalizeRoomMaxPlayers } from '../../multiplayer/roomLimits';
import { AppEventBinder, type BeatAction } from './AppEventBinder';
import { collectElements, type AppElements } from '../dom/appElements';
import { renderTemplate } from '../dom/appTemplate';
import { readCreditInput, readPositiveCreditInput } from '../input/appInputs';
import { hitTestBetZone } from '../input/betZoneHitTest';
import { defaultRoomMaxPlayers } from '../rooms/roomDefaults';
import { isBeatSnapshot } from '../state/appSnapshots';
import { createPlayerFromProfile, type CasinoPlayer } from '../state/casinoPlayer';
import { AudioControls } from '../views/AudioControls';
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
import { GameAppSession } from './GameAppSession';

export class GameApp extends GameAppSession {
  protected readonly table: PixiTable;
  protected readonly elements: AppElements;
  private selectedChip = 0;
  protected selectedPlayerIndex = 0;
  protected activeGame: CasinoGameId = 'beat-the-house';
  protected showingGameLobby = true;
  protected sessionWagerLimit = 0;
  protected sessionWagered = 0;
  private readonly audio = new CasinoAudio();
  protected readonly audioControls: AudioControls;
  protected readonly beatControlsView: BeatControlsView;
  protected readonly beatSeatStatusView: BeatSeatStatusView;
  protected readonly blackjackView: BlackjackView;
  protected readonly gameLobbyView: GameLobbyView;
  protected readonly playerStripView: PlayerStripView;
  protected readonly profileSetupView: ProfileSetupView;
  protected readonly roomBrowserView: RoomBrowserView;
  protected readonly roomSeatsView: RoomSeatsView;
  protected readonly rulesMenuView: RulesMenuView;
  protected readonly slotsView: SlotsView;
  protected readonly walletView: WalletView;
  protected readonly multiplayer: MultiplayerClient;
  protected players: CasinoPlayer[] = [];
  protected profileState: CasinoSaveState = { version: 1, profiles: [] };
  protected lastSaveError = '';
  protected pendingInviteRoomCode = '';
  protected pendingInviteServerUrl = '';
  protected pendingInviteAttempted = false;
  protected multiplayerRooms: readonly RoomSummary[] = [];
  protected realtimeUrl = '';
  protected connectionState: RealtimeConnectionState = 'disconnected';
  protected returnHomeOnServerResync = false;
  protected restoringRoomAfterReconnect = false;
  protected pendingRoomRestore: CasinoSessionRoomState | undefined;

  public constructor(root: HTMLElement) {
    super();
    root.innerHTML = renderTemplate();
    mountRadixChrome();
    this.elements = collectElements();
    this.audioControls = new AudioControls(this.elements, this.audio);
    this.beatControlsView = new BeatControlsView(this.elements);
    this.beatSeatStatusView = new BeatSeatStatusView(this.elements);
    this.blackjackView = new BlackjackView(this.elements);
    this.gameLobbyView = new GameLobbyView(this.elements);
    this.playerStripView = new PlayerStripView(this.elements);
    this.profileSetupView = new ProfileSetupView(this.elements);
    this.roomBrowserView = new RoomBrowserView(this.elements);
    this.roomSeatsView = new RoomSeatsView(this.elements);
    this.rulesMenuView = new RulesMenuView(this.elements);
    this.slotsView = new SlotsView(this.elements);
    this.walletView = new WalletView(this.elements);
    this.multiplayer = new MultiplayerClient({
      onStatus: (status) => {
        this.elements.roomStatus.textContent = status;
      },
      onConnectionState: (state) => {
        if (state === 'reconnecting' && (!this.showingGameLobby || this.multiplayer.room)) {
          this.returnHomeOnServerResync = true;
        }
        this.connectionState = state;
        this.renderConnectionState();
        if (state === 'connected' && this.returnHomeOnServerResync) {
          this.restoreRoomAfterReconnect();
        }
      },
      onDataState: (state) => this.applyServerData(state),
      onError: (message) => {
        if (this.restoringRoomAfterReconnect) {
          const hadRoomState = Boolean(this.multiplayer.room);
          this.multiplayer.clearRoomState();
          if (!hadRoomState) {
            this.returnHomeAfterRoomStateLoss();
          }
          return;
        }
        this.elements.roomStatus.textContent = message;
      },
      onRoom: (room) => {
        this.returnHomeOnServerResync = false;
        this.restoringRoomAfterReconnect = false;
        this.activeGame = room.gameId;
        this.showingGameLobby = false;
        this.elements.roomStatus.textContent = `${room.gameTitle} room ${room.roomId} • ${room.status} • ${room.players.length}/${room.maxPlayers} seated • ${room.spectators.length} spectator(s)`;
        this.syncCurrentRoomBankroll(room);
        this.renderMultiplayerRoom();
        this.renderCasino();
        this.saveSession();
      },
      onRoomCleared: () => this.returnHomeAfterRoomStateLoss(),
      onRoomList: (_gameId, rooms) => {
        this.multiplayerRooms = rooms;
        this.renderRoomBrowser();
      },
      onSettlement: (settlements, room) => this.applyRoomSettlements(settlements, room.roomId, room.sessionId),
    });
    this.table = new PixiTable(
      this.elements.tableHost,
      {
        onBet: (handId: HandId, betType: BetType) => {
          if (this.selectedChip > 0 && this.currentPlayer) {
            if (!this.canWager(this.selectedChip)) {
              this.elements.status.textContent = 'Session wager limit reached.';
              return;
            }
            if (!this.canUseServer()) {
              return;
            }
            if (this.activeRoomForGame()) {
              this.multiplayer.send({ version: protocolVersion, type: 'place-chip', seatId: handId, betType, amount: this.selectedChip });
              this.beatControlsView.markPendingBet(betType);
            }
            this.audio.play('chip');
          }
        },
      },
      {
        createCardRenderer: (layer: Container) => new CardRenderer(layer),
        createChipRenderer: (layer: Container, textures: ReadonlyMap<ChipValue, Texture>) => new ChipRenderer(layer, textures),
        createEffectRenderer: (layer: Container) => new EffectRenderer(layer),
        createTagRenderer: (layer: Container) => new TagRenderer(layer),
      },
    );
  }

  public async start(): Promise<void> {
    this.bindEvents();
    this.audioControls.load();
    this.renderProfileSetup();
    this.applyInviteFromUrl();
    this.ensureRealtimeConnected();
    document.body.dataset.appReady = 'true';
    void this.table
      .init()
      .then(() => {
        this.table.resize();
        this.renderCasino();
      })
      .catch((error) => {
        console.warn('Beat the House table renderer failed to initialize.', error);
      });
  }

  private bindEvents(): void {
    new AppEventBinder(this.elements, {
      createProfile: () => this.createProfileFromInput(),
      startSelectedProfiles: () => this.startSelectedProfiles(),
      refreshMultiplayerRooms: () => this.refreshMultiplayerRooms(),
      hostMultiplayerRoom: () => this.hostMultiplayerRoom(),
      leaveMultiplayerRoom: () => this.leaveMultiplayerRoom(),
      backToLobby: () => this.goHome(),
      switchProfiles: () => this.switchProfiles(),
      updateSessionLimit: () => {
        this.sessionWagerLimit = readCreditInput(this.elements.sessionLimitInput);
        this.saveSession();
        this.renderSessionLimit();
      },
      openRoomLobby: (gameId) => this.openRoomLobby(gameId),
      selectChip: (button) => this.selectChip(button),
      dropChipOnTable: (event) => this.dropChipOnTable(event),
      runBeatAction: (action) => this.runBeatAction(action),
      addMoney: () => this.adjustCurrentBankroll('add'),
      subtractMoney: () => this.adjustCurrentBankroll('subtract'),
      resetMoney: () => this.adjustCurrentBankroll('reset'),
      resetAllProfiles: () => this.resetAllBankrolls(),
      clearSaves: () => this.clearServerData(),
      toggleLayoutOverlay: () => this.table.toggleDebugOverlay(),
      dealBlackjack: () => this.dealBlackjack(),
      hitBlackjack: () => this.sendBlackjackAction('hit'),
      standBlackjack: () => this.sendBlackjackAction('stand'),
      doubleBlackjack: () => this.sendBlackjackAction('double'),
      splitBlackjack: () => this.sendBlackjackAction('split'),
      insureBlackjack: () => this.sendBlackjackAction('insurance'),
      newBlackjackHand: () => this.sendBlackjackAction('new-hand'),
      setSlotsWager: () => this.setMultiplayerSlotsWager(),
      readySlots: () => this.readyMultiplayerSlots(),
      spinSlots: () => this.spinSlots(),
      pickSlotsBonus: () => this.pickSlotsBonus(),
    }).bind();
    this.audioControls.bind();
    window.addEventListener('resize', () => {
      this.table.resize();
      this.beatSeatStatusView.layout();
    });
  }

  private runBeatAction(action: BeatAction): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()) {
      if (action === 'start-round' && this.beatControlsView.shouldQueueStartRound(this.activeRoomForGame())) {
        this.beatControlsView.queueStartRound();
        return;
      }
      this.multiplayer.send(
        typeof action === 'string' ? { version: protocolVersion, type: action } : { version: protocolVersion, type: action.type, action: action.action },
      );
      return;
    }
    this.showRoomRequiredMessage();
  }

  private selectChip(button: HTMLButtonElement): void {
    this.selectedChip = Number(button.dataset.chip);
    this.elements.chipButtons.forEach((chipButton) => chipButton.classList.toggle('selected', chipButton === button));
    this.table.setSelectedChip(this.selectedChip);
    this.elements.status.textContent = `Selected £${this.selectedChip}. Click a betting circle on the table.`;
  }

  private dropChipOnTable(event: DragEvent): void {
    event.preventDefault();
    const amount = Math.floor(Number(event.dataTransfer?.getData('text/plain') || 0));
    const target = hitTestBetZone(this.elements.tableHost, event.clientX, event.clientY);
    if (!target || amount <= 0 || !this.currentPlayer) {
      this.elements.status.textContent = 'Drop a chip on a highlighted betting zone.';
      return;
    }
    if (!this.canUseServer()) {
      return;
    }
    const activeRoom = this.activeRoomForGame();
    if (target.betType !== 'main' && activeRoom && isBeatSnapshot(activeRoom.game) && activeRoom.game.bets[target.handId].main <= 0) {
      this.elements.status.textContent = 'Place a main bet before side bets.';
      return;
    }
    if (activeRoom) {
      this.multiplayer.send({ version: protocolVersion, type: 'place-chip', seatId: target.handId, betType: target.betType, amount });
      this.beatControlsView.markPendingBet(target.betType);
    }
    this.audio.play('chip');
  }

  private showRoomRequiredMessage(): void {
    this.elements.roomStatus.textContent = 'Choose or create a multiplayer room before playing.';
  }

  private hostMultiplayerRoom(): void {
    const profile = this.currentProfile();
    if (!profile) {
      this.elements.roomStatus.textContent = 'Start a profile session before hosting a room.';
      return;
    }
    if (!this.canUseServer()) {
      return;
    }
    const gameId = this.activeGame as RoomGameId;
    const roomName = this.elements.roomNameInput.value.trim() || `${findGame(gameId).title} Room`;
    const maxPlayers = normalizeRoomMaxPlayers(gameId, readCreditInput(this.elements.roomMaxPlayersInput, defaultRoomMaxPlayers(gameId)));
    this.elements.roomMaxPlayersInput.value = String(maxPlayers);
    this.ensureRealtimeConnected();
    this.multiplayer.createRoom(gameId, roomName, maxPlayers, profile.id, profile.name, profile.bankroll);
  }

  protected joinMultiplayerRoom(roomId: string, role: RoomRole = 'player'): void {
    const profile = this.currentProfile();
    if (!profile || !roomId) {
      this.elements.roomStatus.textContent = 'Select a profile and choose a room first.';
      return;
    }
    if (!this.canUseServer()) {
      return;
    }
    const gameId = this.activeGame as RoomGameId;
    this.ensureRealtimeConnected();
    this.multiplayer.joinRoom(gameId, roomId.toUpperCase(), role, profile.id, profile.name, profile.bankroll);
  }

  protected claimRoomSeat(seatId: RoomSeatId): void {
    if (!this.canUseServer()) {
      return;
    }
    if (!this.activeRoomForGame()) {
      this.elements.roomStatus.textContent = 'Join a room before choosing a seat.';
      return;
    }
    this.multiplayer.send({ version: protocolVersion, type: 'assign-seat', seatId });
  }

  private leaveMultiplayerRoom(): void {
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

  private goHome(): void {
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

  private switchProfiles(): void {
    if (this.multiplayer.room && this.multiplayer.connected) {
      this.multiplayer.leaveRoom();
    }
    this.players = [];
    this.selectedPlayerIndex = 0;
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
    this.multiplayer.listRooms(this.activeGame as RoomGameId);
  }

  private ensureRealtimeConnected(): void {
    if (this.multiplayer.connected || this.connectionState === 'connecting' || this.connectionState === 'reconnecting') {
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

  private applyRoomSettlements(settlements: readonly RoomSettlement[], _roomId: string, _sessionId: string): void {
    const profileId = this.currentPlayer?.profileId;
    if (!profileId) {
      return;
    }
    settlements
      .filter((settlement) => settlement.profileId === profileId)
      .forEach((settlement) => {
        if (settlement.wagered > 0) {
          this.recordSessionWager(settlement.wagered);
        }
      });
    this.renderCasino();
  }

  private createProfileFromInput(): void {
    if (!this.canUseServer()) {
      return;
    }
    this.multiplayer.createProfile(this.elements.profileNameInput.value);
    this.elements.profileNameInput.value = '';
  }

  private startSelectedProfiles(): void {
    if (!this.canUseServer()) {
      return;
    }

    const selectedIds = [...this.elements.profileList.querySelectorAll<HTMLInputElement>('[data-profile-select]:checked')].map((checkbox) => checkbox.value);
    const ids = selectedIds.length > 0 ? selectedIds : this.profileState.profiles.slice(0, 1).map((profile) => profile.id);
    if (ids.length === 0) {
      this.lastSaveError = 'Create at least one profile before starting a session.';
      this.renderProfileSetup();
      return;
    }

    this.players = ids
      .map((id) => this.profileState.profiles.find((profile) => profile.id === id))
      .filter((profile): profile is CasinoProfile => Boolean(profile))
      .map((profile) => createPlayerFromProfile(profile));
    this.selectedPlayerIndex = 0;
    this.activeGame = 'beat-the-house';
    this.showingGameLobby = true;
    this.sessionWagered = 0;
    this.sessionWagerLimit = readCreditInput(this.elements.sessionLimitInput);
    this.walletView.resetPreviousBankroll();
    this.elements.setup.classList.add('hidden');
    this.elements.shell.classList.remove('hidden');
    this.table.resize();
    this.renderPlayerButtons();
    this.renderGameLobby();
    this.saveSession();
    this.renderCasino();
    this.maybeAutoJoinInvite();
  }

  private dealBlackjack(): void {
    const player = this.currentPlayer;
    if (!player) {
      return;
    }
    if (!this.canUseServer()) {
      return;
    }

    const wager = readPositiveCreditInput(this.elements.blackjackWager);
    if (this.activeRoomForGame()?.gameId === 'blackjack') {
      this.multiplayer.send({ version: protocolVersion, type: 'blackjack-deal', wager });
      this.audio.play('deal');
      return;
    }
    this.showRoomRequiredMessage();
  }

  private sendBlackjackAction(action: 'hit' | 'stand' | 'double' | 'split' | 'insurance' | 'new-hand'): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId === 'blackjack') {
      this.multiplayer.send({ version: protocolVersion, type: 'blackjack-action', action });
      return;
    }
    this.showRoomRequiredMessage();
  }

  private spinSlots(): void {
    const player = this.currentPlayer;
    if (!player) {
      return;
    }
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId === this.activeGame) {
      this.slotsView.playSpinAnimation();
      this.multiplayer.send({ version: protocolVersion, type: 'slots-spin' });
      this.audio.play('spin');
      return;
    }
    this.showRoomRequiredMessage();
  }

  private setMultiplayerSlotsWager(): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId !== this.activeGame) {
      return;
    }
    const wager = readPositiveCreditInput(this.elements.slotsWager);
    this.multiplayer.send({ version: protocolVersion, type: 'slots-wager', wager });
  }

  private readyMultiplayerSlots(): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId !== this.activeGame) {
      return;
    }
    this.multiplayer.send({ version: protocolVersion, type: 'slots-ready', ready: true });
  }

  private pickSlotsBonus(): void {
    if (!this.canUseServer()) {
      return;
    }
    if (this.activeRoomForGame()?.gameId === this.activeGame) {
      this.multiplayer.send({ version: protocolVersion, type: 'slots-pick-bonus' });
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

  private adjustCurrentBankroll(action: 'add' | 'subtract' | 'reset'): void {
    const profile = this.currentProfile();
    if (!profile || !this.canUseServer()) {
      return;
    }
    if (action === 'reset' && !window.confirm('Reset this profile bankroll to £1,000?')) {
      return;
    }
    this.multiplayer.adjustBankroll(profile.id, action, readPositiveCreditInput(this.elements.moneyInput));
  }

  private resetAllBankrolls(): void {
    if (!this.canUseServer() || !window.confirm('Reset every server profile bankroll to £1,000?')) {
      return;
    }
    this.multiplayer.resetAllBankrolls();
  }

  private clearServerData(): void {
    if (!this.canUseServer() || !window.confirm('Clear all saved profiles and session data?')) {
      return;
    }
    this.players = [];
    this.profileState = { version: 1, profiles: [] };
    this.pendingRoomRestore = undefined;
    this.clearClientSession();
    this.profileSetupView.clearSelection();
    this.multiplayer.clearServerData();
    this.elements.shell.classList.add('hidden');
    this.elements.setup.classList.remove('hidden');
    this.renderProfileSetup();
  }

  private canWager(amount: number): boolean {
    return amount > 0 && (this.sessionWagerLimit <= 0 || this.sessionWagered + amount <= this.sessionWagerLimit);
  }

  private recordSessionWager(amount: number): void {
    this.sessionWagered += Math.max(0, Math.floor(amount));
    this.saveSession();
    this.renderSessionLimit();
  }
}
