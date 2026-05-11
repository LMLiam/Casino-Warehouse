import { Container, Texture } from 'pixi.js';
import { CasinoAudio } from '../../audio/casinoAudio';
import { isBlackjackTableSnapshot } from '../../game/blackjackTable';
import { findGame, findSlotTheme, type CasinoGameId } from '../../game/catalog';
import { SlotsGame } from '../../game/slots';
import type { BetType, GameSnapshot, HandId } from '../../game/types';
import type { ChipValue } from '../../ui/chips';
import { PixiTable } from '../../ui/PixiTable';
import { mountRadixChrome } from '../../ui/radixChrome';
import { CardRenderer } from '../../ui/renderers/CardRenderer';
import { ChipRenderer } from '../../ui/renderers/ChipRenderer';
import { EffectRenderer } from '../../ui/renderers/EffectRenderer';
import { TagRenderer } from '../../ui/renderers/TagRenderer';
import type { CasinoProfile, CasinoSaveState } from '../../state/profiles';
import {
  createSessionState,
  loadSessionState,
  saveSessionState,
  sessionStorageKey,
  type CasinoSessionRoomState,
  type CasinoSessionState,
} from '../../state/session';
import { defaultRealtimeUrl, MultiplayerClient, type RealtimeConnectionState, type ServerDataState } from '../../multiplayer/client';
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
import { money } from '../format/appMoney';
import { readCreditInput, readPositiveCreditInput, inviteServerUrl, parseGameId } from '../input/appInputs';
import { hitTestBetZone } from '../input/betZoneHitTest';
import { defaultRoomMaxPlayers } from '../rooms/roomDefaults';
import { isBeatSnapshot, isSlotSnapshot } from '../state/appSnapshots';
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
export class GameApp {
  private readonly table: PixiTable;
  private readonly elements: AppElements;
  private selectedChip = 0;
  private selectedPlayerIndex = 0;
  private activeGame: CasinoGameId = 'beat-the-house';
  private showingGameLobby = true;
  private sessionWagerLimit = 0;
  private sessionWagered = 0;
  private readonly audio = new CasinoAudio();
  private readonly audioControls: AudioControls;
  private readonly beatControlsView: BeatControlsView;
  private readonly beatSeatStatusView: BeatSeatStatusView;
  private readonly blackjackView: BlackjackView;
  private readonly gameLobbyView: GameLobbyView;
  private readonly playerStripView: PlayerStripView;
  private readonly profileSetupView: ProfileSetupView;
  private readonly roomBrowserView: RoomBrowserView;
  private readonly roomSeatsView: RoomSeatsView;
  private readonly rulesMenuView: RulesMenuView;
  private readonly slotsView: SlotsView;
  private readonly walletView: WalletView;
  private readonly multiplayer: MultiplayerClient;
  private players: CasinoPlayer[] = [];
  private profileState: CasinoSaveState = { version: 1, profiles: [] };
  private lastSaveError = '';
  private pendingInviteRoomCode = '';
  private pendingInviteServerUrl = '';
  private pendingInviteAttempted = false;
  private multiplayerRooms: readonly RoomSummary[] = [];
  private realtimeUrl = '';
  private connectionState: RealtimeConnectionState = 'disconnected';
  private returnHomeOnServerResync = false;
  private restoringRoomAfterReconnect = false;
  private pendingRoomRestore: CasinoSessionRoomState | undefined;

  public constructor(root: HTMLElement) {
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

  private get currentPlayer(): CasinoPlayer | undefined {
    return this.players[this.selectedPlayerIndex];
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

  private joinMultiplayerRoom(roomId: string, role: RoomRole = 'player'): void {
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

  private claimRoomSeat(seatId: RoomSeatId): void {
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

  private refreshMultiplayerRooms(): void {
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

  private renderMultiplayerRoom(): void {
    const room = this.multiplayer.room;
    if (!room) {
      this.roomSeatsView.clear();
      this.beatControlsView.clearPending();
      this.beatSeatStatusView.clear();
      return;
    }
    this.roomSeatsView.render(room, this.currentPlayer?.profileId, (seatId) => this.claimRoomSeat(seatId));
    if (room.gameId === 'beat-the-house' && isBeatSnapshot(room.game)) {
      this.table.render(room.game);
      this.renderBeatControls(room.game);
    }
    this.renderRoomBrowser();
  }

  private openRoomLobby(gameId: CasinoGameId): void {
    this.activeGame = gameId;
    this.showingGameLobby = false;
    this.multiplayerRooms = [];
    this.elements.roomStatus.textContent = `Browsing ${findGame(gameId).title} rooms.`;
    this.saveSession();
    this.renderCasino();
    this.refreshMultiplayerRooms();
  }

  private renderRoomBrowser(): void {
    this.roomBrowserView.render(this.activeGame, this.multiplayerRooms, (roomId, role) => this.joinMultiplayerRoom(roomId, role));
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

  private renderProfileSetup(): void {
    this.profileSetupView.render(
      this.profileState,
      this.lastSaveError,
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

  private applyServerData(state: ServerDataState): void {
    this.profileState = state.profileState;
    this.lastSaveError = '';
    this.players = this.players
      .map((player) => {
        const profile = this.profileState.profiles.find((candidate) => candidate.id === player.profileId);
        if (profile) {
          player.beatTheHouse.syncBankroll(profile.bankroll);
        }
        return profile ? player : undefined;
      })
      .filter((player): player is CasinoPlayer => Boolean(player));
    if (this.players.length === 0) {
      const clientSession = this.loadClientSession();
      if (clientSession?.profileIds.length) {
        this.restoreSavedSession(clientSession);
      }
    }
    this.selectedPlayerIndex = Math.min(this.selectedPlayerIndex, Math.max(0, this.players.length - 1));
    if (this.returnHomeOnServerResync && !this.multiplayer.room) {
      this.returnHomeOnServerResync = false;
      this.showingGameLobby = true;
      this.multiplayerRooms = [];
      this.elements.roomStatus.textContent = 'The room could not be restored. Choose a game to start or join a new room.';
    }
    this.renderProfileSetup();
    if (this.players.length === 0 && this.pendingInviteRoomCode && !this.pendingInviteAttempted) {
      this.elements.roomStatus.textContent = `Invite loaded for room ${this.pendingInviteRoomCode}. Select a profile to join.`;
    }
    if (this.players.length === 0) {
      this.showingGameLobby = true;
      this.multiplayerRooms = [];
      this.elements.shell.classList.add('hidden');
      this.elements.setup.classList.remove('hidden');
      this.roomSeatsView.clear();
      this.beatControlsView.clearPending();
      this.beatSeatStatusView.clear();
      this.multiplayer.clearRoomState();
      return;
    }
    if (this.players.length > 0) {
      this.elements.setup.classList.add('hidden');
      this.elements.shell.classList.remove('hidden');
      this.renderPlayerButtons();
      this.renderGameLobby();
      this.renderCasino();
      if (this.returnHomeOnServerResync) {
        this.restoreRoomAfterReconnect();
        return;
      }
      if (this.maybeRestoreSavedRoom()) {
        return;
      }
      if (!this.showingGameLobby && this.multiplayer.connected) {
        this.refreshMultiplayerRooms();
      }
      this.maybeAutoJoinInvite();
    }
  }

  private restoreSavedSession(session: CasinoSessionState): void {
    const restoredPlayers = session.profileIds
      .map((profileId) => this.profileState.profiles.find((profile) => profile.id === profileId))
      .filter((profile): profile is CasinoProfile => Boolean(profile))
      .map((profile) => createPlayerFromProfile(profile, session.gameSnapshots[profile.id]));
    if (restoredPlayers.length === 0) {
      this.clearClientSession();
      return;
    }

    this.players = restoredPlayers;
    this.selectedPlayerIndex = Math.min(session.selectedPlayerIndex, restoredPlayers.length - 1);
    this.activeGame = session.activeGame;
    this.sessionWagerLimit = session.wagerLimit;
    this.sessionWagered = session.wagered;
    this.showingGameLobby = true;
    this.pendingRoomRestore = session.room;
    this.elements.sessionLimitInput.value = this.sessionWagerLimit > 0 ? String(this.sessionWagerLimit) : '';
  }

  private returnHomeAfterRoomStateLoss(): void {
    this.returnHomeOnServerResync = false;
    this.restoringRoomAfterReconnect = false;
    this.showingGameLobby = true;
    this.multiplayerRooms = [];
    this.elements.roomStatus.textContent = 'The room could not be restored. Choose a game to start or join a new room.';
    this.roomSeatsView.clear();
    this.beatControlsView.clearPending();
    this.beatSeatStatusView.clear();
    this.renderGameLobby();
    this.renderCasino();
    this.saveSession();
  }

  private restoreRoomAfterReconnect(): void {
    const room = this.multiplayer.room;
    const profile = this.currentProfile();
    const role = profile
      ? room?.players.some((candidate) => candidate.profileId === profile.id)
        ? 'player'
        : room?.spectators.some((candidate) => candidate.profileId === profile.id)
          ? 'spectator'
          : undefined
      : undefined;
    this.returnHomeOnServerResync = false;
    if (!room || !profile || !role) {
      this.multiplayer.clearRoomState();
      return;
    }

    this.attemptRoomRestore(
      { roomId: room.roomId, gameId: room.gameId, role, seatId: room.seats.find((seat) => seat.profileId === profile.id)?.seatId },
      profile,
      room.gameTitle,
    );
  }

  private maybeRestoreSavedRoom(): boolean {
    const room = this.pendingRoomRestore;
    const profile = this.currentProfile();
    if (!room || !profile || this.pendingInviteRoomCode || !this.multiplayer.connected) {
      return false;
    }
    this.pendingRoomRestore = undefined;
    this.attemptRoomRestore(room, profile, findGame(room.gameId).title);
    return true;
  }

  private attemptRoomRestore(room: CasinoSessionRoomState, profile: CasinoProfile, gameTitle: string): void {
    this.restoringRoomAfterReconnect = true;
    this.showingGameLobby = true;
    this.activeGame = room.gameId;
    this.multiplayerRooms = [];
    this.elements.roomStatus.textContent = `Checking ${gameTitle} room ${room.roomId} against the server.`;
    this.renderGameLobby();
    this.renderCasino();
    this.multiplayer.joinRoom(room.gameId, room.roomId, room.role, profile.id, profile.name, profile.bankroll, room.seatId);
  }

  private applyInviteFromUrl(): void {
    this.realtimeUrl = inviteServerUrl() ?? defaultRealtimeUrl();
    this.pendingInviteServerUrl = this.realtimeUrl;
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room')?.trim().toUpperCase() ?? '';
    const gameId = parseGameId(params.get('game')?.trim());
    if (!roomId) {
      return;
    }
    this.pendingInviteRoomCode = roomId;
    if (gameId) {
      this.activeGame = gameId;
    }
    this.elements.roomStatus.textContent = `Invite loaded for room ${roomId}. Select a profile to join.`;
  }

  private maybeAutoJoinInvite(): void {
    if (!this.pendingInviteRoomCode || this.pendingInviteAttempted || !this.currentProfile()) {
      return;
    }
    this.pendingInviteAttempted = true;
    this.showingGameLobby = false;
    this.renderCasino();
    this.realtimeUrl = this.pendingInviteServerUrl || this.realtimeUrl || defaultRealtimeUrl();
    this.joinMultiplayerRoom(this.pendingInviteRoomCode, 'player');
  }

  private renderPlayerButtons(): void {
    this.playerStripView.render(this.players, (playerIndex) => {
      this.selectedPlayerIndex = playerIndex;
      this.walletView.resetPreviousBankroll();
      this.saveSession();
      this.renderCasino();
    });
  }

  private renderCasino(): void {
    const player = this.currentPlayer;
    if (!player) {
      return;
    }

    this.elements.gameTabs.forEach((button) => button.classList.toggle('selected', button.dataset.game === this.activeGame));
    this.elements.playerStrip.querySelectorAll<HTMLButtonElement>('[data-player]').forEach((button) => {
      button.classList.toggle('selected', Number(button.dataset.player) === this.selectedPlayerIndex);
    });

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
    const blackjackSnapshot = isBlackjack && activeRoom && isBlackjackTableSnapshot(activeRoom.game) ? activeRoom.game : player.blackjack.snapshot();
    const slotsSnapshot = isSlots && activeRoom && isSlotSnapshot(activeRoom.game) ? activeRoom.game : this.currentSlots().snapshot();
    const showingRoomLobby = !this.showingGameLobby && !activeRoom;
    this.elements.gameLobby.classList.toggle('hidden', !this.showingGameLobby);
    this.elements.roomLobby.classList.toggle('hidden', !showingRoomLobby);
    this.elements.tableHost.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !isBeatTheHouse);
    this.elements.blackjackView.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !isBlackjack);
    this.elements.slotsView.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !isSlots);
    this.elements.status.classList.toggle('hidden', this.showingGameLobby || showingRoomLobby || !isBeatTheHouse);
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
    this.table.render(beatSnapshot);
    this.beatSeatStatusView.render(beatSnapshot, isBeatTheHouse ? activeRoom : undefined, player.profileId, (seatId) => this.claimRoomSeat(seatId));
    this.renderWallet(beatSnapshot, roomMember?.bankroll);
    this.renderBeatControls(beatSnapshot, canUseGameControls);
    this.blackjackView.render(blackjackSnapshot, player.profileId);
    this.slotsView.render(slotsSnapshot, this.activeGame, activeRoom, player.profileId);
    this.renderRoomBrowser();
    this.rulesMenuView.render(activeCatalogGame);
    this.renderSessionLimit();
  }

  private renderGameLobby(): void {
    this.gameLobbyView.render((gameId) => this.openRoomLobby(gameId));
  }

  private renderBeatControls(snapshot: GameSnapshot, controlsAvailable = true): void {
    this.beatControlsView.render(
      snapshot,
      findGame(this.activeGame).kind === 'beat-the-house',
      () => this.multiplayer.send({ version: protocolVersion, type: 'start-round' }),
      controlsAvailable,
    );
  }

  private renderWallet(snapshot: GameSnapshot, bankrollOverride?: number): void {
    this.walletView.render(snapshot, this.currentProfile(), bankrollOverride);
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

  private currentSlots(): SlotsGame {
    const theme = findSlotTheme(this.activeGame);
    return this.currentPlayer?.slots[theme.id] ?? new SlotsGame({ theme });
  }

  private activeRoomForGame(): RoomSnapshot | undefined {
    return this.multiplayer.room?.gameId === this.activeGame ? this.multiplayer.room : undefined;
  }

  private syncCurrentRoomBankroll(room: RoomSnapshot): void {
    const player = this.currentPlayer;
    if (!player) {
      return;
    }
    const roomMember =
      room.players.find((candidate) => candidate.profileId === player.profileId) ??
      room.spectators.find((candidate) => candidate.profileId === player.profileId);
    if (roomMember) {
      this.syncProfileBankroll(player.profileId, roomMember.bankroll);
    }
  }

  private syncProfileBankroll(profileId: string, bankroll: number): void {
    const profile = this.profileState.profiles.find((candidate) => candidate.id === profileId);
    const nextBankroll = Math.max(0, Math.floor(bankroll));
    this.players.find((player) => player.profileId === profileId)?.beatTheHouse.syncBankroll(nextBankroll);
    const currentBankroll = profile?.bankroll;
    if (!profile || currentBankroll === nextBankroll) {
      return;
    }
    this.profileState = {
      ...this.profileState,
      profiles: this.profileState.profiles.map((candidate) =>
        candidate.id === profile.id ? { ...profile, bankroll: nextBankroll, updatedAt: new Date().toISOString() } : candidate,
      ),
    };
    this.saveSession();
  }

  private canUseServer(): boolean {
    if (this.multiplayer.connected) {
      return true;
    }
    this.connectionState = 'reconnecting';
    this.renderConnectionState();
    this.elements.roomStatus.textContent = 'Reconnecting to the server. Actions are paused.';
    return false;
  }

  private renderConnectionState(): void {
    const blocking = this.connectionState === 'connecting' || this.connectionState === 'reconnecting' || this.connectionState === 'disconnected';
    this.elements.connectionOverlay.classList.toggle('hidden', !blocking);
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

  private renderSessionLimit(): void {
    const limitText = this.sessionWagerLimit > 0 ? ` / ${money(this.sessionWagerLimit)}` : ' / no limit';
    this.elements.sessionNotice.textContent = `Session wagered ${money(this.sessionWagered)}${limitText}. Fictional currency only.`;
  }

  private saveSession(): void {
    if (this.players.length === 0) {
      return;
    }
    try {
      saveSessionState(
        localStorage,
        createSessionState(
          this.players.map((player) => player.profileId),
          {
            selectedPlayerIndex: this.selectedPlayerIndex,
            activeGame: this.activeGame,
            showingGameLobby: this.showingGameLobby,
            wagerLimit: this.sessionWagerLimit,
            wagered: this.sessionWagered,
            room: this.currentSessionRoom(),
            gameSnapshots: Object.fromEntries(
              this.players.map((player) => [
                player.profileId,
                {
                  blackjack: player.blackjack.snapshot(),
                  beatTheHouse: player.beatTheHouse.saveState(),
                  slots: Object.fromEntries(Object.entries(player.slots).map(([themeId, slots]) => [themeId, slots.snapshot()])),
                },
              ]),
            ),
          },
        ),
      );
    } catch (error) {
      console.warn('Session could not be saved in this browser.', error);
    }
  }

  private loadClientSession(): CasinoSessionState | undefined {
    try {
      return loadSessionState(localStorage).session;
    } catch (error) {
      console.warn('Session could not be loaded in this browser.', error);
      return undefined;
    }
  }

  private clearClientSession(): void {
    try {
      localStorage.removeItem(sessionStorageKey);
    } catch (error) {
      console.warn('Session could not be cleared in this browser.', error);
    }
  }

  private currentSessionRoom(): CasinoSessionRoomState | undefined {
    const room = this.multiplayer.room;
    const profile = this.currentProfile();
    if (!room || !profile) {
      return undefined;
    }
    const role = room.players.some((candidate) => candidate.profileId === profile.id)
      ? 'player'
      : room.spectators.some((candidate) => candidate.profileId === profile.id)
        ? 'spectator'
        : undefined;
    const seatId = room.seats.find((seat) => seat.profileId === profile.id)?.seatId;
    return role ? { roomId: room.roomId, gameId: room.gameId, role, seatId } : undefined;
  }

  private currentProfile(): CasinoProfile | undefined {
    const player = this.currentPlayer;
    return player ? this.profileState.profiles.find((profile) => profile.id === player.profileId) : undefined;
  }
}
