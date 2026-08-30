import { Container, Texture } from 'pixi.js';
import { CasinoAudio } from '../../audio/casinoAudio/CasinoAudio';
import type { CasinoGameId } from '../../game/ids';
import type { BeatTheHouseChipTarget } from '../../game/types/BeatTheHouseChipTarget';
import type { HandId } from '../../game/types/HandId';
import type { ChipValue } from '../../ui/chips/ChipValue';
import { PixiTable } from '../../ui/PixiTable/PixiTable';
import { mountRadixChrome } from '../../ui/radixChrome';
import { CardRenderer } from '../../ui/renderers/CardRenderer';
import { ChipRenderer } from '../../ui/renderers/ChipRenderer';
import { EffectRenderer } from '../../ui/renderers/EffectRenderer';
import { TagRenderer } from '../../ui/renderers/TagRenderer';
import type { CasinoSaveState } from '../../state/profiles/CasinoSaveState';
import type { CasinoSessionRoomState } from '../../state/session/CasinoSessionRoomState';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import { MultiplayerClient } from '../../multiplayer/client/MultiplayerClient';
import type { RealtimeConnectionState } from '../../multiplayer/client/RealtimeConnectionState';
import type { RoomSummary } from '../../multiplayer/protocol/RoomSummary';
import type { CasinoPlayer } from '../state/casinoPlayer/CasinoPlayer';
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
import { AppEventBinder } from './AppEventBinder';
import type { AppElements } from '../dom/appElements/AppElements';
import { collectElements } from '../dom/appElements/collectElements';
import { renderTemplate } from '../dom/appTemplate';
import { readCreditInput } from '../input/appInputs/readCreditInput';
import { BeatChipSelection } from './BeatChipSelection';
import { BeatSettlementMetadataCache } from './BeatSettlementMetadataCache';
import { GameAppProfileActions } from './GameAppProfileActions';

export class GameApp extends GameAppProfileActions {
  protected readonly table: PixiTable;
  protected readonly elements: AppElements;
  protected readonly beatChipSelection: BeatChipSelection;
  protected activeGame: CasinoGameId = 'beat-the-house';
  protected showingGameLobby = true;
  protected sessionWagerLimit = 0;
  protected sessionWagered = 0;
  protected readonly audio = new CasinoAudio();
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
  protected player: CasinoPlayer | undefined;
  protected readonly beatSettlementMetadata = new BeatSettlementMetadataCache();
  protected profileState: CasinoSaveState = { profiles: [] };
  protected readonly ownedProfileIds = new Set<ProfileId>();
  protected profileAccessReceived = false;
  protected lastSaveError = '';
  protected pendingInviteRoomCode: RoomId | '' = '';
  protected pendingInviteServerUrl = '';
  protected pendingInviteAttempted = false;
  protected multiplayerRooms: readonly RoomSummary[] = [];
  protected realtimeUrl = '';
  protected realtimeUrlError = '';
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
    this.beatControlsView = new BeatControlsView(this.elements, (bankroll, canSelectChip) => this.beatChipSelection.syncBankroll(bankroll, canSelectChip));
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
      onProfileAccess: (ownedProfileIds) => this.applyProfileAccess(ownedProfileIds),
      onAdminAccess: (authorized) => this.applyAdminAccess(authorized),
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
        onBet: (handId: HandId, chipTarget: BeatTheHouseChipTarget) => {
          if (this.beatChipSelection.value > 0 && this.currentPlayer) {
            if (!this.beatChipSelection.ensureSelectedAffordable()) {
              return;
            }
            const selectedChip = this.beatChipSelection.value;
            if (chipTarget !== 'dealerTip' && !this.canWager(selectedChip)) {
              return;
            }
            if (!this.canUseServer()) {
              return;
            }
            if (this.activeRoomForGame()) {
              if (chipTarget === 'dealerTip') {
                this.multiplayer.send({ type: 'place-tip', seatId: handId, amount: selectedChip });
                this.beatControlsView.markPendingBet('dealerTip');
              } else {
                this.multiplayer.send({ type: 'place-chip', seatId: handId, betType: chipTarget, amount: selectedChip });
                this.beatControlsView.markPendingBet(chipTarget);
              }
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
    this.beatChipSelection = new BeatChipSelection(this.elements.chipButtons, this.table);
  }

  public async start(): Promise<void> {
    this.bindEvents();
    this.audioControls.load();
    this.renderProfileSetup();
    this.renderAdminControls();
    this.applyInviteFromUrl();
    this.ensureRealtimeConnected();
    document.body.dataset.appReady = 'true';
    void this.table
      .init()
      .then(() => {
        this.table.resize();
        this.renderCasino();
      })
      .catch(() => {
        console.warn('Beat the House table renderer failed to initialize.');
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
      acceptHouseAdvance: () => this.acceptHouseAdvance(),
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
      authorizeAdmin: () => this.authorizeAdmin(),
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
}
