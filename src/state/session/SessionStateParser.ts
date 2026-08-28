import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import { gameCatalog } from '../../game/catalog/gameCatalog';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import type { CasinoGameId } from '../../game/ids';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import type { CasinoSessionRoomState } from './CasinoSessionRoomState';
import type { PlayerGameSnapshots } from './PlayerGameSnapshots';
import type { SessionRoomSeatId } from './SessionRoomSeatId';
import type { SessionStateInput } from './SessionStateInput';

export class SessionStateParser {
  public static isGameId(value: string | undefined): value is CasinoGameId {
    return typeof value === 'string' && gameCatalog.some((game) => game.id === value);
  }

  public static safeMoney(value: number | string | null | undefined): number {
    const numericValue = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
    return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
  }

  public static parseRoomState(value: SessionStateInput['room']): CasinoSessionRoomState | undefined {
    if (!value) {
      return undefined;
    }
    const roomId = typeof value.roomId === 'string' ? value.roomId.trim().toUpperCase() : '';
    const gameId = SessionStateParser.isGameId(value.gameId) ? value.gameId : undefined;
    const role = value.role === 'player' || value.role === 'spectator' ? value.role : undefined;
    const seatId = SessionStateParser.parseRoomSeatId(value.seatId);
    return roomId && gameId && role ? { roomId, gameId, role, seatId } : undefined;
  }

  public static parseUpdatedAt(value: string | null | undefined): Date {
    const date = typeof value === 'string' ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  public static parseGameSnapshot(value: SessionStateInput['gameSnapshot']): PlayerGameSnapshots | undefined {
    if (!value) {
      return undefined;
    }

    return {
      beatTheHouse: SessionStateParser.parseSnapshotRecord<BeatTheHouseSaveState>(value.beatTheHouse),
      blackjack: SessionStateParser.parseSnapshotRecord<BlackjackSnapshot>(value.blackjack),
      slots: SessionStateParser.parseSlotSnapshots(value.slots),
    };
  }

  private static parseRoomSeatId(value: string | null | undefined): SessionRoomSeatId | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const seatId = value.trim();
    return seatId === 'left' || seatId === 'centre' || seatId === 'right' || /^seat-\d+$/.test(seatId) ? (seatId as SessionRoomSeatId) : undefined;
  }

  private static parseSnapshotRecord<Snapshot>(value: Partial<Snapshot> | null | undefined): Snapshot | undefined {
    return value ? (value as Snapshot) : undefined;
  }

  private static parseSlotSnapshots(value: NonNullable<SessionStateInput['gameSnapshot']>['slots']): Readonly<Record<string, SlotSnapshot>> | undefined {
    if (!value) {
      return undefined;
    }
    return Object.fromEntries(Object.entries(value).filter(([, snapshot]) => snapshot)) as Readonly<Record<string, SlotSnapshot>>;
  }
}
