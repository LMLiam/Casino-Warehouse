import type { HandId } from '../../game/types/HandId';
import type { RoomSeatId } from '../../multiplayer/protocol/RoomSeatId';
import type { RoomSettlement } from '../../multiplayer/protocol/RoomSettlement';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import type { PixiTableSettlementMetadata } from '../../ui/PixiTable/PixiTableSettlementMetadata';

export class BeatSettlementMetadataCache {
  private readonly metadataByRound = new Map<string, readonly PixiTableSettlementMetadata[]>();

  public get(room: RoomSnapshot | undefined, profileId: string | undefined): readonly PixiTableSettlementMetadata[] {
    if (!room || room.gameId !== 'beat-the-house' || !profileId) {
      return [];
    }
    return this.metadataByRound.get(BeatSettlementMetadataCache.key(room.roomId, room.sessionId, profileId)) ?? [];
  }

  public set(roomId: string, sessionId: string, profileId: string, settlements: readonly RoomSettlement[]): void {
    this.metadataByRound.set(
      BeatSettlementMetadataCache.key(roomId, sessionId, profileId),
      settlements.flatMap((settlement): PixiTableSettlementMetadata[] => {
        const handId = BeatSettlementMetadataCache.beatHandIdForSeat(settlement.seatId);
        return handId ? [{ handId, houseAdvanceRepayment: settlement.houseAdvanceRepayment }] : [];
      }),
    );
  }

  private static key(roomId: string, sessionId: string, profileId: string): string {
    return `${roomId}:${sessionId}:${profileId}`;
  }

  private static beatHandIdForSeat(seatId: RoomSeatId): HandId | undefined {
    return seatId === 'left' || seatId === 'centre' || seatId === 'right' ? seatId : undefined;
  }
}
