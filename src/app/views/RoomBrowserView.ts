import { findGame, type CasinoGameId } from '../../game/catalog';
import type { RoomRole, RoomSummary } from '../../multiplayer/protocol';
import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements';
import { defaultRoomMaxPlayers } from '../rooms/roomDefaults';
import { minRoomPlayers } from '../../multiplayer/roomLimits';

export class RoomBrowserView {
  public constructor(private readonly elements: AppElements) {}

  public render(activeGame: CasinoGameId, rooms: readonly RoomSummary[], onJoin: (roomId: string, role: RoomRole) => void): void {
    const game = findGame(activeGame);
    const maxPlayers = defaultRoomMaxPlayers(activeGame);
    this.elements.roomGameTitle.textContent = game.title;
    this.elements.roomGameDescription.textContent = game.description;
    this.elements.roomMaxPlayersInput.min = String(minRoomPlayers(activeGame));
    this.elements.roomMaxPlayersInput.max = String(maxPlayers);
    this.elements.roomMaxPlayersInput.value = String(maxPlayers);
    this.elements.roomBrowser.innerHTML =
      rooms.length === 0
        ? '<p class="session-notice">No rooms for this game yet.</p>'
        : rooms
            .map(
              (room) => `
                <article class="room-card" data-room-id="${room.roomId}">
                  <b>${escapeHtml(room.roomName)}</b>
                  <span>${escapeHtml(room.status)} • ${room.currentPlayers}/${room.maxPlayers} seated • ${room.spectators} watching</span>
                  <div class="room-card-actions">
                    <button class="primary" type="button" data-room-join="${room.roomId}">Join Room</button>
                    <button type="button" data-room-spectate="${room.roomId}">Spectate</button>
                  </div>
                </article>
              `,
            )
            .join('');
    this.elements.roomBrowser.querySelectorAll<HTMLButtonElement>('[data-room-join]').forEach((button) => {
      button.addEventListener('click', () => onJoin(button.dataset.roomJoin ?? '', 'player'));
    });
    this.elements.roomBrowser.querySelectorAll<HTMLButtonElement>('[data-room-spectate]').forEach((button) => {
      button.addEventListener('click', () => onJoin(button.dataset.roomSpectate ?? '', 'spectator'));
    });
  }
}
