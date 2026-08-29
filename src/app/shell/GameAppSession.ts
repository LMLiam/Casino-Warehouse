import { findGame } from '../../game/catalog/findGame';
import { findSlotTheme } from '../../game/catalog/findSlotTheme';
import { createIsoTimestamp } from '../../schemas/casinoSchemas/createIsoTimestamp';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import { roomIdSchema } from '../../schemas/casinoSchemas/roomIdSchema';
import { defaultRealtimeUrl } from '../../multiplayer/client/defaultRealtimeUrl';
import type { ServerDataState } from '../../multiplayer/client/ServerDataState';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import type { CasinoProfile } from '../../state/profiles/CasinoProfile';
import type { CasinoSessionRoomState } from '../../state/session/CasinoSessionRoomState';
import type { CasinoSessionState } from '../../state/session/CasinoSessionState';
import { createSessionState } from '../../state/session/createSessionState';
import { loadSessionState } from '../../state/session/loadSessionState';
import { saveSessionState } from '../../state/session/saveSessionState';
import { sessionStorageKey } from '../../state/session/sessionStorageKey';
import { SlotsGame } from '../../game/slots/SlotsGame';
import type { CasinoPlayer } from '../state/casinoPlayer/CasinoPlayer';
import { createPlayerFromProfile } from '../state/casinoPlayer/createPlayerFromProfile';
import { inviteServerUrl } from '../input/appInputs/inviteServerUrl';
import { parseGameId } from '../input/appInputs/parseGameId';
import { GameAppRendering } from './GameAppRendering';

export abstract class GameAppSession extends GameAppRendering {
  protected abstract realtimeUrl: string;
  protected abstract returnHomeOnServerResync: boolean;
  protected abstract restoringRoomAfterReconnect: boolean;
  protected abstract pendingRoomRestore: CasinoSessionRoomState | undefined;
  protected abstract pendingInviteRoomCode: RoomId | '';
  protected abstract pendingInviteServerUrl: string;
  protected abstract pendingInviteAttempted: boolean;
  protected abstract realtimeUrlError: string;

  protected get currentPlayer(): CasinoPlayer | undefined {
    return this.player;
  }

  protected applyServerData(state: ServerDataState): void {
    this.profileState = state.profileState;
    this.lastSaveError = '';
    if (this.player) {
      const profile = this.profileState.profiles.find((candidate) => candidate.id === this.player?.profileId);
      if (profile && this.ownedProfileIds.has(profile.id)) {
        this.player.beatTheHouse.syncBankroll(profile.bankroll);
      } else {
        this.player = undefined;
      }
    }
    if (!this.player && this.profileAccessReceived) {
      const clientSession = this.loadClientSession();
      if (clientSession) {
        this.restoreSavedSession(clientSession);
      }
    }
    if (this.returnHomeOnServerResync && !this.multiplayer.room) {
      this.returnHomeOnServerResync = false;
      this.showingGameLobby = true;
      this.multiplayerRooms = [];
      this.elements.roomStatus.textContent = 'The room could not be restored. Choose a game to start or join a new room.';
    }
    this.renderProfileSetup();
    if (!this.player && this.pendingInviteRoomCode && !this.pendingInviteAttempted) {
      this.elements.roomStatus.textContent = `Invite loaded for room ${this.pendingInviteRoomCode}. Select a profile to join.`;
    }
    if (!this.player) {
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

    this.elements.setup.classList.add('hidden');
    this.elements.shell.classList.remove('hidden');
    this.renderPlayerProfile();
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

  protected restoreSavedSession(session: CasinoSessionState): void {
    const profile = this.profileState.profiles.find((candidate) => candidate.id === session.profileId);
    if (!profile || !this.ownedProfileIds.has(profile.id)) {
      this.clearClientSession();
      return;
    }

    this.player = createPlayerFromProfile(profile, session.gameSnapshot);
    this.activeGame = session.activeGame;
    this.sessionWagerLimit = session.wagerLimit;
    this.sessionWagered = session.wagered;
    this.showingGameLobby = true;
    this.pendingRoomRestore = session.room;
    this.elements.sessionLimitInput.value = this.sessionWagerLimit > 0 ? String(this.sessionWagerLimit) : '';
  }

  protected returnHomeAfterRoomStateLoss(): void {
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

  protected restoreRoomAfterReconnect(): void {
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

  protected maybeRestoreSavedRoom(): boolean {
    const room = this.pendingRoomRestore;
    const profile = this.currentProfile();
    if (!room || !profile || this.pendingInviteRoomCode || !this.multiplayer.connected) {
      return false;
    }
    this.pendingRoomRestore = undefined;
    this.attemptRoomRestore(room, profile, findGame(room.gameId).title);
    return true;
  }

  protected attemptRoomRestore(room: CasinoSessionRoomState, profile: CasinoProfile, gameTitle: string): void {
    this.restoringRoomAfterReconnect = true;
    this.showingGameLobby = true;
    this.activeGame = room.gameId;
    this.multiplayerRooms = [];
    this.elements.roomStatus.textContent = `Checking ${gameTitle} room ${room.roomId} against the server.`;
    this.renderGameLobby();
    this.renderCasino();
    this.multiplayer.joinRoom(room.gameId, room.roomId, room.role, profile.id, profile.name, profile.bankroll, room.seatId);
  }

  protected applyInviteFromUrl(): void {
    const inviteUrl = inviteServerUrl();
    this.realtimeUrlError = inviteUrl.invalid ? 'Invite server URL must use ws:// or wss://.' : '';
    this.realtimeUrl = inviteUrl.url ?? (this.realtimeUrlError ? '' : defaultRealtimeUrl());
    this.pendingInviteServerUrl = this.realtimeUrl;
    const params = new URLSearchParams(window.location.search);
    const parsedRoomId = roomIdSchema.safeParse(params.get('room')?.trim() ?? '');
    const roomId = parsedRoomId.success ? parsedRoomId.data : '';
    const gameId = parseGameId(params.get('game')?.trim());
    if (!roomId) {
      if (this.realtimeUrlError) {
        this.elements.roomStatus.textContent = this.realtimeUrlError;
      }
      return;
    }
    this.pendingInviteRoomCode = roomId;
    if (gameId) {
      this.activeGame = gameId;
    }
    if (this.realtimeUrlError) {
      this.realtimeUrlError = `Invite loaded for room ${roomId}, but the server URL must use ws:// or wss://.`;
      this.elements.roomStatus.textContent = this.realtimeUrlError;
      return;
    }
    this.elements.roomStatus.textContent = `Invite loaded for room ${roomId}. Select a profile to join.`;
  }

  protected maybeAutoJoinInvite(): void {
    if (!this.pendingInviteRoomCode || this.pendingInviteAttempted || !this.currentProfile()) {
      return;
    }
    this.pendingInviteAttempted = true;
    this.showingGameLobby = false;
    this.renderCasino();
    this.realtimeUrl = this.pendingInviteServerUrl || this.realtimeUrl || defaultRealtimeUrl();
    const roomId = this.pendingInviteRoomCode;
    if (roomId) {
      this.joinMultiplayerRoom(roomId, 'player');
    }
  }

  protected syncCurrentRoomBankroll(room: RoomSnapshot): void {
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

  protected syncProfileBankroll(profileId: ProfileId, bankroll: number): void {
    const profile = this.profileState.profiles.find((candidate) => candidate.id === profileId);
    const nextBankroll = Math.max(0, Math.floor(bankroll));
    if (this.player?.profileId === profileId) {
      this.player.beatTheHouse.syncBankroll(nextBankroll);
    }
    const currentBankroll = profile?.bankroll;
    if (!profile || currentBankroll === nextBankroll) {
      return;
    }
    this.profileState = {
      ...this.profileState,
      profiles: this.profileState.profiles.map((candidate) =>
        candidate.id === profile.id ? { ...profile, bankroll: nextBankroll, updatedAt: createIsoTimestamp(new Date()) } : candidate,
      ),
    };
    this.saveSession();
  }

  protected currentSlots(): SlotsGame {
    const theme = findSlotTheme(this.activeGame);
    return this.currentPlayer?.slots.get(theme.id) ?? new SlotsGame({ theme });
  }

  protected saveSession(): void {
    const player = this.player;
    if (!player) {
      return;
    }
    try {
      saveSessionState(
        localStorage,
        createSessionState(player.profileId, {
          activeGame: this.activeGame,
          showingGameLobby: this.showingGameLobby,
          wagerLimit: this.sessionWagerLimit,
          wagered: this.sessionWagered,
          room: this.currentSessionRoom(),
          gameSnapshot: {
            blackjack: player.blackjack.snapshot(),
            beatTheHouse: player.beatTheHouse.saveState(),
            slots: Object.fromEntries([...player.slots.entries()].map(([themeId, slots]) => [themeId, slots.snapshot()])),
          },
        }),
      );
    } catch (error) {
      console.warn('Session could not be saved in this browser.', error);
    }
  }

  protected loadClientSession(): CasinoSessionState | undefined {
    try {
      return loadSessionState(localStorage).session;
    } catch (error) {
      console.warn('Session could not be loaded in this browser.', error);
      return undefined;
    }
  }

  protected clearClientSession(): void {
    try {
      localStorage.removeItem(sessionStorageKey);
    } catch (error) {
      console.warn('Session could not be cleared in this browser.', error);
    }
  }

  protected currentSessionRoom(): CasinoSessionRoomState | undefined {
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

  protected currentProfile(): CasinoProfile | undefined {
    const player = this.currentPlayer;
    return player ? this.profileState.profiles.find((profile) => profile.id === player.profileId) : undefined;
  }

  protected abstract refreshMultiplayerRooms(): void;
  protected abstract activeRoomForGame(): RoomSnapshot | undefined;
}
