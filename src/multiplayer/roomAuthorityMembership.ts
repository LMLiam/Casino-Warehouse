import type { ConnectionId } from '../schemas/casinoSchemas/ConnectionId';
import type { ProfileId } from '../schemas/casinoSchemas/ProfileId';
import type { CasinoProfile } from '../state/profiles/CasinoProfile';
import type { RoomPlayer } from './protocol/RoomPlayer';
import type { RoomSettlement } from './protocol/RoomSettlement';
import type { RoomSnapshot } from './protocol/RoomSnapshot';
import type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';
import type { RoomState } from './roomAuthorityModel/RoomState';
import { safeBankroll } from './roomAuthorityModel/safeBankroll';
import { RoomAuthoritySettlement } from './roomAuthoritySettlement';

export abstract class RoomAuthorityMembership extends RoomAuthoritySettlement {
  protected addMember(
    room: RoomState,
    connectionId: ConnectionId,
    role: 'player' | 'spectator',
    profileId: ProfileId,
    profileName: string,
    bankroll: number,
    sessionStartBankroll?: number,
  ): void {
    const centralBankroll = this.centralBankroll(profileId, profileName, bankroll);
    const player: RoomPlayer = {
      connectionId,
      profileId,
      profileName,
      bankroll: centralBankroll,
      sessionStartBankroll: sessionStartBankroll ?? centralBankroll,
      role,
    };
    room.connectionToMember.set(connectionId, { profileId, role });
    if (role === 'spectator') {
      room.spectators.set(profileId, player);
      room.players.delete(profileId);
    } else {
      room.players.set(profileId, player);
      room.spectators.delete(profileId);
    }
  }

  protected centralBankroll(profileId: ProfileId, profileName: string, fallback: number): number {
    return this.dataStore.ensureProfile(profileId, profileName, fallback).bankroll;
  }

  protected setPlayerBankroll(room: RoomState, profileId: ProfileId, bankroll: number): void {
    const player = room.players.get(profileId);
    if (!player) {
      return;
    }
    const nextBankroll = safeBankroll(bankroll);
    const updated = this.dataStore.setProfileBankroll(profileId, nextBankroll);
    room.players.set(profileId, { ...player, bankroll: updated?.bankroll ?? nextBankroll });
  }

  protected reconcileRooms(reason: string, profileId?: ProfileId): AuthorityResult {
    const profiles = new Map(this.dataStore.snapshot().profileState.profiles.map((profile) => [profile.id, profile]));
    const broadcasts: RoomSnapshot[] = [];
    const settlements: RoomSettlement[] = [];
    const roomClosures: Array<NonNullable<AuthorityResult['roomClosures']>[number]> = [];

    for (const room of [...this.rooms.values()]) {
      if (profileId && !this.roomHasProfile(room, profileId)) {
        continue;
      }
      const beforeConnectionIds = this.roomConnectionIds(room);
      const removedConnectionIds: ConnectionId[] = [];
      let changed = false;

      for (const memberProfileId of this.roomProfileIds(room)) {
        const profile = profiles.get(memberProfileId);
        if (!profile) {
          removedConnectionIds.push(...this.profileConnectionIds(room, memberProfileId));
          this.removeExistingMember(room, memberProfileId);
          changed = true;
          continue;
        }
        changed = this.updateRoomProfile(room, profile) || changed;
      }

      if (!changed) {
        continue;
      }

      if (!room.serverManaged && (!this.roomHasProfile(room, room.hostProfileId) || this.roomMemberCount(room) === 0)) {
        this.clearBeatReadiness(room);
        this.rooms.delete(room.roomId);
        roomClosures.push({ roomId: room.roomId, gameId: room.gameId, connectionIds: RoomAuthorityMembership.unique(beforeConnectionIds), reason });
        continue;
      }

      if (room.serverManaged && this.roomMemberCount(room) === 0) {
        const resetResult = this.resetServerManagedRoom(room);
        if (resetResult?.error) {
          return resetResult;
        }
        settlements.push(...(resetResult?.settlements ?? []));
      }
      this.syncBeatBankroll(room);
      if (removedConnectionIds.length > 0) {
        roomClosures.push({ roomId: room.roomId, gameId: room.gameId, connectionIds: RoomAuthorityMembership.unique(removedConnectionIds), reason });
      }
      const broadcastSnapshot = this.broadcast(room).broadcasts[0];
      if (!broadcastSnapshot) {
        throw new Error('Broadcast produced no snapshot.');
      }
      broadcasts.push(broadcastSnapshot);
    }

    return { broadcasts, settlements, roomClosures };
  }

  protected clearAllRooms(reason: string): AuthorityResult {
    const broadcasts: RoomSnapshot[] = [];
    const settlements: RoomSettlement[] = [];
    const roomClosures: Array<NonNullable<AuthorityResult['roomClosures']>[number]> = [];
    const broadcastRecipients: Array<NonNullable<AuthorityResult['broadcastRecipients']>[number]> = [];

    for (const room of [...this.rooms.values()]) {
      const connectionIds = this.roomConnectionIds(room);
      if (!room.serverManaged) {
        this.clearBeatReadiness(room);
        roomClosures.push({ roomId: room.roomId, gameId: room.gameId, connectionIds, reason });
        this.rooms.delete(room.roomId);
        continue;
      }
      const resetResult = this.resetServerManagedRoom(room);
      if (resetResult?.error) {
        return resetResult;
      }
      room.players.clear();
      room.spectators.clear();
      room.connectionToMember.clear();
      const snapshot = this.broadcast(room).broadcasts[0];
      if (!snapshot) {
        throw new Error('Broadcast produced no snapshot.');
      }
      broadcasts.push(snapshot);
      if (connectionIds.length > 0) {
        broadcastRecipients.push({ roomId: snapshot.roomId, connectionIds });
      }
      if (resetResult) {
        settlements.push(...resetResult.settlements);
      }
    }

    return { broadcasts, settlements, roomClosures, broadcastRecipients };
  }

  protected removeExistingMember(room: RoomState, profileId: ProfileId): void {
    const existing = room.players.get(profileId) ?? room.spectators.get(profileId);
    if (existing) {
      room.connectionToMember.delete(existing.connectionId);
    }
    room.players.delete(profileId);
    room.spectators.delete(profileId);
    for (const [seatId, ownerProfileId] of room.seats.entries()) {
      if (ownerProfileId === profileId) {
        room.seats.delete(seatId);
      }
    }
    this.removeProfileGameState(room, profileId);
  }

  protected removeProfileGameState(room: RoomState, profileId: ProfileId): void {
    if (room.model.kind === 'beat-the-house') {
      room.model.readyProfileIds.delete(profileId);
    }
    if (room.model.kind === 'slots') {
      room.model.readyProfileIds.delete(profileId);
      room.model.wagersByProfileId.delete(profileId);
      room.model.returnedByProfileId.delete(profileId);
    }
  }

  protected abstract clearBeatReadiness(room: RoomState): void;

  protected abstract resetServerManagedRoom(room: RoomState): AuthorityResult | undefined;

  protected abstract syncBeatBankroll(room: RoomState): void;

  private roomProfileIds(room: RoomState): readonly ProfileId[] {
    return RoomAuthorityMembership.unique([
      ...room.players.keys(),
      ...room.spectators.keys(),
      ...[...room.seats.values()].filter((profileId): profileId is ProfileId => Boolean(profileId)),
    ]);
  }

  private roomConnectionIds(room: RoomState): readonly ConnectionId[] {
    return RoomAuthorityMembership.unique([
      ...room.connectionToMember.keys(),
      ...[...room.players.values(), ...room.spectators.values()].map((player) => player.connectionId),
    ]);
  }

  private profileConnectionIds(room: RoomState, profileId: ProfileId): readonly ConnectionId[] {
    return RoomAuthorityMembership.unique(
      [room.players.get(profileId)?.connectionId, room.spectators.get(profileId)?.connectionId].filter((connectionId): connectionId is ConnectionId =>
        Boolean(connectionId),
      ),
    );
  }

  private roomHasProfile(room: RoomState, profileId: ProfileId): boolean {
    return this.roomProfileIds(room).includes(profileId);
  }

  private roomMemberCount(room: RoomState): number {
    return room.players.size + room.spectators.size;
  }

  private updateRoomProfile(room: RoomState, profile: CasinoProfile): boolean {
    let changed = false;
    const update = (player: RoomPlayer): RoomPlayer => {
      if (player.profileName === profile.name && Object.is(player.bankroll, profile.bankroll)) {
        return player;
      }
      changed = true;
      return { ...player, profileName: profile.name, bankroll: profile.bankroll };
    };
    const player = room.players.get(profile.id);
    if (player) {
      room.players.set(profile.id, update(player));
    }
    const spectator = room.spectators.get(profile.id);
    if (spectator) {
      room.spectators.set(profile.id, update(spectator));
    }
    return changed;
  }

  private static unique<Value>(values: readonly Value[]): Value[] {
    return [...new Set(values)];
  }
}
