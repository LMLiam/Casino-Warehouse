import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { ProfileToken } from '../../schemas/casinoSchemas/ProfileToken';
import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import type { ServerDataStore } from '../../state/serverDataStore/ServerDataStore';
import { createSessionState } from '../../state/session/createSessionState';
import { profileTokenAuth } from '../../state/serverDataStore/profileTokenAuth';
import type { ClientMessage } from '../protocol/ClientMessage';
import { parseClientMessage } from '../protocol/parseClientMessage';
import type { AuthorityResult } from '../roomAuthorityModel/AuthorityResult';
import type { CasinoRoomAuthority } from './CasinoRoomAuthority';
import type { Peer } from './Peer';
import { CasinoServerState } from './CasinoServerState';

export class CasinoServerMessageHandler {
  private static readonly maxHouseAdvanceCount = 3;

  public constructor(
    private readonly state: CasinoServerState,
    private readonly authority: CasinoRoomAuthority,
    private readonly dataStore: ServerDataStore,
    private readonly adminToken: string | undefined,
  ) {}

  public handle(peer: Peer, payload: string): void {
    let parsedJson: JsonValue;
    try {
      parsedJson = parseJsonText(payload);
    } catch {
      this.state.send(peer, { type: 'error', code: 'bad-json', message: 'Message was not valid JSON.' });
      return;
    }

    const parsed = parseClientMessage(parsedJson);
    if (!parsed.ok || !parsed.message) {
      this.state.send(peer, { type: 'error', code: 'bad-message', message: parsed.error ?? 'Message was invalid.' });
      return;
    }
    if (this.handleDataMessage(peer, parsed.message)) {
      return;
    }

    let serverOwnedMessage: ClientMessage;
    try {
      serverOwnedMessage = this.useServerProfile(peer, parsed.message);
    } catch (error) {
      this.state.send(peer, {
        type: 'error',
        code: 'rejected',
        message: error instanceof Error ? error.message : 'Server rejected the player action.',
      });
      return;
    }

    let result: AuthorityResult;
    try {
      result = this.authority.handle(peer.id, serverOwnedMessage);
    } catch {
      this.state.send(peer, { type: 'error', code: 'rejected', message: 'Server could not complete the room action. Try again.' });
      return;
    }
    if (serverOwnedMessage.type === 'list-rooms') {
      peer.browsingGameId = serverOwnedMessage.gameId;
    }
    this.state.emitAuthorityResult(peer, result);
  }

  private handleDataMessage(peer: Peer, message: ReturnType<typeof parseClientMessage>['message']): boolean {
    if (!message) {
      return false;
    }
    try {
      switch (message.type) {
        case 'heartbeat-ack':
          peer.lastPongAt = Date.now();
          return true;
        case 'authorize-profiles':
          this.authorizeProfiles(peer, message.profileTokens);
          this.state.sendProfileAccess(peer);
          return true;
        case 'authorize-admin':
          peer.isAdmin = this.adminToken !== undefined && profileTokenAuth.safeSecretEqual(this.adminToken, message.adminToken);
          this.state.sendAdminAccess(peer);
          return true;
        case 'request-data':
          this.state.sendDataState(peer);
          return true;
        case 'create-profile':
          this.createOwnedProfile(peer, message.profileName);
          this.state.broadcastDataState();
          return true;
        case 'rename-profile':
          this.requireOwnedProfile(peer, message.profileId);
          this.dataStore.renameProfile(message.profileId, message.profileName);
          this.state.emitAuthorityResult(peer, this.authority.reconcileProfiles('profile-renamed'), { forceDataState: true });
          return true;
        case 'delete-profile':
          this.requireOwnedProfile(peer, message.profileId);
          this.dataStore.deleteProfile(message.profileId);
          peer.ownedProfileIds.delete(message.profileId);
          this.state.sendProfileAccess(peer);
          this.state.emitAuthorityResult(peer, this.authority.removeProfile(message.profileId, 'profile-deleted'), { forceDataState: true });
          return true;
        case 'house-advance':
          this.acceptHouseAdvance(peer, message.profileId);
          this.state.emitAuthorityResult(peer, this.authority.reconcileProfiles('house-advance-accepted'), { forceDataState: true });
          return true;
        case 'save-session':
          this.requireProfile(message.session.profileId);
          this.requireOwnedProfile(peer, message.session.profileId);
          this.dataStore.saveSession(createSessionState(message.session.profileId, message.session));
          this.state.sendDataState(peer);
          return true;
        case 'admin-bankroll':
          this.requireAdmin(peer);
          this.applyAdminBankroll(message.profileId, message.action, message.amount ?? 0);
          this.state.emitAuthorityResult(peer, this.authority.reconcileProfiles('bankroll-updated'), { forceDataState: true });
          return true;
        case 'admin-reset-all':
          this.requireAdmin(peer);
          this.resetAllBankrolls();
          this.state.emitAuthorityResult(peer, this.authority.reconcileProfiles('bankroll-reset'), { forceDataState: true });
          return true;
        case 'clear-server-data': {
          this.requireAdmin(peer);
          const clearedRooms = this.authority.clearRooms('server-data-cleared');
          if (clearedRooms.error) {
            this.state.emitAuthorityResult(peer, clearedRooms);
            return true;
          }
          this.dataStore.clear();
          for (const candidate of this.state.peers.values()) {
            candidate.ownedProfileIds.clear();
            this.state.sendProfileAccess(candidate);
          }
          this.state.emitAuthorityResult(peer, clearedRooms, { forceDataState: true });
          return true;
        }
        default:
          return false;
      }
    } catch (error) {
      this.state.send(peer, {
        type: 'error',
        code: 'rejected',
        message: error instanceof Error ? error.message : 'Server data action failed.',
      });
      return true;
    }
  }

  private createOwnedProfile(peer: Peer, profileName: string): void {
    const snapshot = this.dataStore.createProfile(profileName, 1000);
    const profile = snapshot.profileState.profiles.at(-1);
    if (!profile) {
      throw new Error('Profile could not be created.');
    }
    const profileToken = profileTokenAuth.createToken();
    this.dataStore.setProfileTokenHash(profile.id, profileTokenAuth.hash(profile.id, profileToken));
    peer.ownedProfileIds.add(profile.id);
    this.state.send(peer, { type: 'profile-credentials', profileId: profile.id, profileToken });
    this.state.sendProfileAccess(peer);
  }

  private authorizeProfiles(peer: Peer, profileTokens: readonly { readonly profileId: ProfileId; readonly profileToken: ProfileToken }[]): void {
    peer.ownedProfileIds.clear();
    for (const { profileId, profileToken } of profileTokens) {
      if (this.isProfileTokenValid(profileId, profileToken)) {
        peer.ownedProfileIds.add(profileId);
      }
    }
  }

  private requireOwnedProfile(peer: Peer, profileId: ProfileId) {
    const profile = this.requireProfile(profileId);
    if (!peer.ownedProfileIds.has(profileId)) {
      throw new Error('This browser is not authorized to use that profile.');
    }
    return profile;
  }

  private requireAdmin(peer: Peer): void {
    if (!peer.isAdmin) {
      throw new Error('Admin controls are locked for this browser.');
    }
  }

  private isProfileTokenValid(profileId: ProfileId, profileToken: ProfileToken): boolean {
    const expectedHash = this.dataStore.profileTokenHash(profileId);
    return Boolean(expectedHash) && profileTokenAuth.matches(profileId, profileToken, expectedHash ?? '');
  }

  private applyAdminBankroll(profileId: ProfileId, action: 'add' | 'subtract' | 'reset', amount: number): void {
    const profile = this.requireProfile(profileId);
    const delta =
      action === 'add'
        ? Math.max(0, Math.floor(amount))
        : action === 'subtract'
          ? -Math.min(profile.bankroll, Math.max(0, Math.floor(amount)))
          : 1000 - profile.bankroll;
    const clearsHouseAdvance = action === 'reset' && (profile.houseAdvance.outstandingBalance > 0 || profile.houseAdvance.activeCount > 0);
    if (delta !== 0 || clearsHouseAdvance) {
      this.dataStore.recordTransaction(profileId, {
        gameId: 'admin',
        type: action === 'reset' ? 'reset' : 'admin_adjustment',
        amount: delta,
        description: `Admin bankroll ${action}`,
        metadata: {},
      });
    }
  }

  private resetAllBankrolls(): void {
    for (const profile of this.dataStore.snapshot().profileState.profiles) {
      const delta = 1000 - profile.bankroll;
      if (delta !== 0 || profile.houseAdvance.outstandingBalance > 0 || profile.houseAdvance.activeCount > 0) {
        this.dataStore.recordTransaction(profile.id, { gameId: 'admin', type: 'reset', amount: delta, description: 'Admin reset all profiles', metadata: {} });
      }
    }
  }

  private acceptHouseAdvance(peer: Peer, profileId: ProfileId): void {
    const profile = this.requireOwnedProfile(peer, profileId);
    const updated = this.dataStore.acceptHouseAdvance(profile.id);
    if (!updated) {
      if (profile.bankroll > 0) {
        throw new Error('House Advance is available only when this profile has no credits.');
      }
      if (profile.houseAdvance.activeCount >= CasinoServerMessageHandler.maxHouseAdvanceCount && profile.houseAdvance.outstandingBalance > 0) {
        throw new Error('House Advance is unavailable until the current balance is repaid.');
      }
      throw new Error('House Advance could not be accepted for this profile.');
    }
  }

  private requireProfile(profileId: ProfileId) {
    const profile = this.dataStore.snapshot().profileState.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      throw new Error('Profile was not found.');
    }
    return profile;
  }

  private useServerProfile(peer: Peer, message: ClientMessage): ClientMessage {
    if (message.type !== 'create-room' && message.type !== 'join-room') {
      return message;
    }
    const profile = this.requireOwnedProfile(peer, message.profileId);
    return { ...message, profileName: profile.name, bankroll: profile.bankroll };
  }
}
