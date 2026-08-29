import type { HandId } from '../../game/types/HandId';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { SessionId } from '../../schemas/casinoSchemas/SessionId';
import { handIdSchema } from '../../schemas/casinoSchemas/handIdSchema';
import type { RoomSeatId } from '../../multiplayer/protocol/RoomSeatId';
import type { RoomSettlement } from '../../multiplayer/protocol/RoomSettlement';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import type { PixiTableSettlementMetadata } from '../../ui/PixiTable/PixiTableSettlementMetadata';

export class BeatSettlementMetadataCache {
  private readonly metadataByRound = new Map<string, readonly PixiTableSettlementMetadata[]>();

  public get(room: RoomSnapshot | undefined, profileId: ProfileId | undefined): readonly PixiTableSettlementMetadata[] {
    if (!room || room.gameId !== 'beat-the-house' || !profileId) {
      return [];
    }
    return this.metadataByRound.get(BeatSettlementMetadataCache.key(room.roomId, room.sessionId, profileId)) ?? [];
  }

  public set(roomId: RoomId, sessionId: SessionId, profileId: ProfileId, settlements: readonly RoomSettlement[]): void {
    this.metadataByRound.set(
      BeatSettlementMetadataCache.key(roomId, sessionId, profileId),
      settlements.flatMap((settlement): PixiTableSettlementMetadata[] => {
        const handId = BeatSettlementMetadataCache.beatHandIdForSeat(settlement.seatId);
        return handId ? [{ handId, houseAdvanceRepayment: settlement.houseAdvanceRepayment }] : [];
      }),
    );
  }

  private static key(roomId: RoomId, sessionId: SessionId, profileId: ProfileId): string {
    return `${roomId}:${sessionId}:${profileId}`;
  }

  private static beatHandIdForSeat(seatId: RoomSeatId): HandId | undefined {
    const parsed = handIdSchema.safeParse(seatId);
    return parsed.success ? parsed.data : undefined;
  }
}
