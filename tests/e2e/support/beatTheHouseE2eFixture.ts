import type { Card } from '../../../src/game/cards/Card';
import { beatTheHouseRules } from '../../../src/game/beatTheHouse/beatTheHouseRules';
import { BeatTheHouseShoe } from '../../../src/game/beatTheHouse/shoe/BeatTheHouseShoe';
import { createBeatTheHouseShoeCards } from '../../../src/game/beatTheHouse/shoe/createBeatTheHouseShoeCards';
import { connectionIdSchema } from '../../../src/schemas/casinoSchemas/connectionIdSchema';
import { handIds } from '../../../src/game/types/handIds';
import type { ClientMessage } from '../../../src/multiplayer/protocol/ClientMessage';
import { RoomAuthority } from '../../../src/multiplayer/roomAuthority';
import type { AuthorityResult } from '../../../src/multiplayer/roomAuthorityModel/AuthorityResult';
import type { RoomState } from '../../../src/multiplayer/roomAuthorityModel/RoomState';
import type { ServerDataStore } from '../../../src/state/serverDataStore/ServerDataStore';
import { totalBeatStake } from '../../../src/multiplayer/roomAuthorityModel/totalBeatStake';

/** Describe one validated private shoe used by a browser test. */
export type BeatTheHouseShoeFixtureOptions = {
  readonly dealOrder: readonly Card[];
  readonly cardsDealt?: number;
  readonly cutThresholdCardsDealt?: number;
};

/** Build a complete, validated six-deck shoe with a known draw suffix. */
const createBeatTheHouseShoeFixture = (options: BeatTheHouseShoeFixtureOptions): BeatTheHouseShoe => {
  const availableCards = createBeatTheHouseShoeCards();
  for (const expectedCard of options.dealOrder) {
    const matchingIndex = availableCards.findIndex((card) => card.rank === expectedCard.rank && card.suit === expectedCard.suit);
    if (matchingIndex < 0) {
      throw new Error(`Test shoe cannot contain ${expectedCard.rank} of ${expectedCard.suit}.`);
    }
    availableCards.splice(matchingIndex, 1);
  }

  const cardsDealt = options.cardsDealt ?? 0;
  const fillerCardCount = beatTheHouseRules.cardsPerShoe - cardsDealt - options.dealOrder.length;
  if (cardsDealt < 0 || fillerCardCount < 0 || fillerCardCount > availableCards.length) {
    throw new Error('Test shoe card count is invalid.');
  }

  const cutThresholdCardsDealt = options.cutThresholdCardsDealt ?? beatTheHouseRules.cutThreshold.minimum;
  return new BeatTheHouseShoe({
    remainingCards: [...availableCards.slice(0, fillerCardCount), ...[...options.dealOrder].reverse()],
    totalCards: beatTheHouseRules.cardsPerShoe,
    cutThresholdCardsDealt,
    shufflePending: cardsDealt >= cutThresholdCardsDealt,
  });
};

/** Provide deterministic private shoe state to a Beat the House room in E2E tests. */
export class BeatTheHouseE2EAuthority extends RoomAuthority {
  private nextShoeIndex = 0;

  /**
   * Create an authority that replaces each Beat the House shoe at round start.
   *
   * @param dataStore Store used for profiles and authoritative settlements.
   * @param shoeFixtures Validated shoe descriptions, in round order.
   * @throws {Error} If `shoeFixtures` is empty.
   */
  public constructor(
    dataStore: ServerDataStore,
    private readonly shoeFixtures: readonly BeatTheHouseShoeFixtureOptions[],
  ) {
    super(dataStore);
    if (shoeFixtures.length === 0) {
      throw new Error('At least one Beat the House shoe fixture is required.');
    }
  }

  /**
   * Handle a room action and apply the next private shoe before a Beat the House deal.
   *
   * @param connectionId The authenticated room connection that sent the action.
   * @param message The validated client room action.
   * @returns The authoritative broadcasts and any settlements produced by the action.
   * @throws {Error} If the connection identifier or shoe fixture is invalid.
   */
  public override handle(connectionId: string, message: ClientMessage): AuthorityResult {
    if (message.type !== 'start-round') {
      return super.handle(connectionId, message);
    }
    const room = this.roomForConnection(connectionId);
    if (room?.model.kind !== 'beat-the-house') {
      return super.handle(connectionId, message);
    }

    const before = room.model.game.snapshot();
    const shoeFixture = this.shoeFixtures[Math.min(this.nextShoeIndex, this.shoeFixtures.length - 1)];
    if (!shoeFixture) {
      throw new Error('Expected a Beat the House shoe fixture.');
    }
    room.model.game.restoreState({ ...room.model.game.saveState(), shoe: createBeatTheHouseShoeFixture(shoeFixture).saveState() });
    this.nextShoeIndex += 1;
    room.beatHandOwners = {};
    for (const handId of handIds) {
      const ownerProfileId = room.seats.get(handId);
      if (ownerProfileId && totalBeatStake(before, handId) > 0) {
        room.beatHandOwners[handId] = ownerProfileId;
      }
    }
    const snapshot = room.model.game.deal();
    room.lastBeatEvents = snapshot.lastEvents;
    const settlements = snapshot.phase === 'roundOver' && before.phase !== 'roundOver' ? this.settleBeat(room, snapshot) : [];
    return this.broadcast(room, settlements);
  }

  private roomForConnection(connectionId: string): RoomState | undefined {
    const parsedConnectionId = connectionIdSchema.parse(connectionId);
    return [...this.rooms.values()].find((room) => room.connectionToMember.has(parsedConnectionId));
  }
}
