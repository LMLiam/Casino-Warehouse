import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import { gameCatalog } from '../../game/catalog/gameCatalog';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import type { CasinoGameId } from '../../game/ids';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import type { CasinoSessionRoomState } from './CasinoSessionRoomState';
import type { PlayerGameSnapshots } from './PlayerGameSnapshots';
import type { SessionRoomSeatId } from './SessionRoomSeatId';

export class SessionStateParser {
  public static isGameId(value: unknown): value is CasinoGameId {
    return typeof value === 'string' && gameCatalog.some((game) => game.id === value);
  }

  public static safeMoney(value: unknown): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;
  }

  public static parseRoomState(value: unknown): CasinoSessionRoomState | undefined {
    if (!SessionStateParser.isRecord(value)) {
      return undefined;
    }
    const roomId = typeof value.roomId === 'string' ? value.roomId.trim().toUpperCase() : '';
    const gameId = SessionStateParser.isGameId(value.gameId) ? value.gameId : undefined;
    const role = value.role === 'player' || value.role === 'spectator' ? value.role : undefined;
    const seatId = SessionStateParser.parseRoomSeatId(value.seatId);
    return roomId && gameId && role ? { roomId, gameId, role, seatId } : undefined;
  }

  public static parseUpdatedAt(value: unknown): Date {
    const date = typeof value === 'string' ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  public static parseGameSnapshots(value: unknown): Readonly<Record<string, PlayerGameSnapshots>> {
    if (!SessionStateParser.isRecord(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).flatMap(([profileId, snapshots]) => {
        if (!SessionStateParser.isRecord(snapshots)) {
          return [];
        }

        return [
          [
            profileId,
            {
              beatTheHouse: SessionStateParser.parseSnapshotRecord<BeatTheHouseSaveState>(snapshots.beatTheHouse),
              blackjack: SessionStateParser.parseSnapshotRecord<BlackjackSnapshot>(snapshots.blackjack),
              slots: SessionStateParser.parseSlotSnapshots(snapshots.slots),
            },
          ],
        ];
      }),
    );
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private static parseRoomSeatId(value: unknown): SessionRoomSeatId | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const seatId = value.trim();
    return seatId === 'left' || seatId === 'centre' || seatId === 'right' || /^seat-\d+$/.test(seatId) ? (seatId as SessionRoomSeatId) : undefined;
  }

  private static parseSnapshotRecord<Snapshot>(value: unknown): Snapshot | undefined {
    return SessionStateParser.isRecord(value) ? (value as Snapshot) : undefined;
  }

  private static parseSlotSnapshots(value: unknown): Readonly<Record<string, SlotSnapshot>> | undefined {
    if (!SessionStateParser.isRecord(value)) {
      return undefined;
    }
    return Object.fromEntries(Object.entries(value).filter(([, snapshot]) => SessionStateParser.isRecord(snapshot))) as Readonly<Record<string, SlotSnapshot>>;
  }
}
