import { canSharedSlotsTransition } from '../state/roomMachines/canSharedSlotsTransition';
import { deriveSharedSlotsPhase } from '../state/roomMachines/deriveSharedSlotsPhase';
import type { ProfileId } from '../schemas/casinoSchemas/ProfileId';
import type { RoomRole } from './protocol/RoomRole';
import type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';
import type { RoomState } from './roomAuthorityModel/RoomState';
import { createSessionId } from './roomAuthorityModel/createSessionId';
import { RoomAuthorityBase } from './roomAuthorityBase';

export abstract class RoomAuthoritySlots extends RoomAuthorityBase {
  protected setSlotsWager(room: RoomState, profileId: ProfileId, role: RoomRole, wager: number): AuthorityResult {
    if (room.model.kind !== 'slots') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot wager.');
    }
    const player = room.players.get(profileId);
    if (!player || wager <= 0 || player.bankroll < wager) {
      return this.error('Insufficient profile bankroll for that wager.');
    }
    room.model.wagersByProfileId.set(profileId, wager);
    room.model.readyProfileIds.delete(profileId);
    return this.broadcast(room);
  }

  protected setSlotsReady(room: RoomState, profileId: ProfileId, role: RoomRole, ready: boolean): AuthorityResult {
    if (room.model.kind !== 'slots') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot ready spins.');
    }
    if (ready && !room.model.wagersByProfileId.has(profileId) && room.model.game.snapshot().freeSpinsRemaining <= 0) {
      return this.error('Set your Slots wager before readying.');
    }
    if (ready) {
      room.model.readyProfileIds.add(profileId);
    } else {
      room.model.readyProfileIds.delete(profileId);
    }
    return this.broadcast(room);
  }

  protected spinSlots(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
    if (room.model.kind !== 'slots') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot spin.');
    }
    if (room.model.game.snapshot().phase === 'bonus') {
      return this.error('Finish the Slots bonus before spinning again.');
    }
    const sharedPhase = deriveSharedSlotsPhase(
      room.players.size,
      room.model.wagersByProfileId.size,
      room.model.readyProfileIds.size,
      room.model.game.snapshot().phase,
    );
    if (!canSharedSlotsTransition(sharedPhase, { type: 'SPIN' })) {
      return this.error('Every room player must be ready before the shared spin.');
    }
    const snapshot = room.model.game.snapshot();
    const usingFreeSpin = snapshot.freeSpinsRemaining > 0;
    if (!usingFreeSpin) {
      for (const player of room.players.values()) {
        const wager = room.model.wagersByProfileId.get(player.profileId) ?? 0;
        if (wager <= 0) {
          return this.error('Every room player must set a wager before the shared spin.');
        }
        if (player.bankroll < wager) {
          return this.error('Every room player must be able to afford their wager.');
        }
      }
      for (const player of room.players.values()) {
        const wager = room.model.wagersByProfileId.get(player.profileId) ?? 0;
        this.setPlayerBankroll(room, player.profileId, player.bankroll - wager);
      }
    }
    room.sessionId = createSessionId();
    room.model.lastSpinByProfileId = profileId;
    room.model.readyProfileIds.clear();
    room.model.returnedByProfileId.clear();
    const model = room.model;
    const before = model.game.snapshot();
    const baseWager = Math.max(1, ...[...room.players.keys()].map((playerId) => model.wagersByProfileId.get(playerId) ?? 0));
    const after = model.game.spin(baseWager);
    return this.broadcast(room, this.settleSlots(room, before, after));
  }

  protected pickSlotsBonus(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
    if (room.model.kind !== 'slots') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot pick bonus prizes.');
    }
    const before = room.model.game.snapshot();
    const after = room.model.game.pickBonus();
    room.model.lastSpinByProfileId = profileId;
    return this.broadcast(room, this.settleSlots(room, before, after));
  }
}
