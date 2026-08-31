import type { RoomSeatId } from '../../multiplayer/protocol/RoomSeatId';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import { roomSeatIdSchema } from '../../schemas/casinoSchemas/roomSeatIdSchema';
import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements/AppElements';
import { capitalize } from '../format/appText';

export class RoomSeatsView {
  public constructor(private readonly elements: AppElements) {}

  public clear(): void {
    this.elements.roomSeats.textContent = 'No active room.';
  }

  public render(room: RoomSnapshot, profileId?: ProfileId, onClaimSeat?: (seatId: RoomSeatId) => void): void {
    const currentProfileHasSeat = room.seats.some((seat) => seat.profileId === profileId);
    const currentProfileCanClaimSeat =
      Boolean(profileId && onClaimSeat) &&
      !currentProfileHasSeat &&
      room.spectators.some((spectator) => spectator.profileId === profileId) &&
      room.players.length < room.maxPlayers;
    this.elements.roomSeats.innerHTML = room.seats
      .map((seat) => {
        const owner = room.players.find((player) => player.profileId === seat.profileId);
        const label = owner ? `${capitalize(seat.seatId)}: ${owner.profileName}` : `${capitalize(seat.seatId)}: open`;
        const mine = profileId && seat.profileId === profileId ? ' mine' : '';
        if (!owner && currentProfileCanClaimSeat) {
          return `<button type="button" class="room-seat claimable" data-claim-seat="${seat.seatId}">${escapeHtml(label)}</button>`;
        }
        return `<span class="room-seat${mine}">${escapeHtml(label)}</span>`;
      })
      .join('');
    this.elements.roomSeats.querySelectorAll<HTMLButtonElement>('[data-claim-seat]').forEach((button) => {
      button.addEventListener('click', () => {
        const seatId = roomSeatIdSchema.safeParse(button.dataset.claimSeat);
        if (seatId.success) {
          onClaimSeat?.(seatId.data);
        }
      });
    });
  }
}
