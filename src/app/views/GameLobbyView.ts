import { gameTileAsset } from '../../assets/manifest';
import { gameCatalog, type CasinoGameId } from '../../game/catalog';
import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements';

export class GameLobbyView {
  public constructor(private readonly elements: AppElements) {}

  public render(onOpenRoomLobby: (gameId: CasinoGameId) => void): void {
    this.elements.gameLobbyTiles.innerHTML = gameCatalog
      .map(
        (game) => `
          <button class="game-tile" type="button" data-lobby-game="${game.id}" style="--game-accent: ${game.accent}">
            <span class="game-tile-art" style="background-image: url('${gameTileAsset(game.id).path}')"></span>
            <span>${escapeHtml(game.kind === 'slots' ? 'Slot Machine' : 'Table Game')}</span>
            <b>${escapeHtml(game.title)}</b>
            <small>${escapeHtml(game.description)}</small>
          </button>
        `,
      )
      .join('');
    this.elements.gameLobbyTiles.querySelectorAll<HTMLButtonElement>('[data-lobby-game]').forEach((button) => {
      button.addEventListener('click', () => {
        onOpenRoomLobby(button.dataset.lobbyGame as CasinoGameId);
      });
    });
  }
}
