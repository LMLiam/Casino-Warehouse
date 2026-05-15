import { gameTileAsset } from '../../assets/manifest/gameTileAsset';
import { gameCatalog } from '../../game/catalog/gameCatalog';
import type { CasinoGameId } from '../../game/ids';
import { canAcceptHouseAdvance } from '../../state/profiles/canAcceptHouseAdvance';
import type { CasinoProfile } from '../../state/profiles/CasinoProfile';
import { houseAdvanceConfig } from '../../state/profiles/houseAdvanceConfig';
import { isHouseAdvanceCapped } from '../../state/profiles/isHouseAdvanceCapped';
import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements/AppElements';
import { money } from '../format/appMoney';

export class GameLobbyView {
  public constructor(private readonly elements: AppElements) {}

  public render(profile: CasinoProfile | undefined, onOpenRoomLobby: (gameId: CasinoGameId) => void): void {
    this.renderHouseAdvance(profile);
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

  private renderHouseAdvance(profile: CasinoProfile | undefined): void {
    const title = this.elements.houseAdvancePanel.querySelector<HTMLElement>('#houseAdvanceTitle');
    const message = this.elements.houseAdvancePanel.querySelector<HTMLElement>('#houseAdvanceMessage');
    if (!profile || profile.bankroll > 0) {
      this.elements.houseAdvancePanel.classList.add('hidden');
      this.elements.houseAdvanceButton.classList.add('hidden');
      return;
    }

    this.elements.houseAdvancePanel.classList.remove('hidden');
    if (canAcceptHouseAdvance(profile)) {
      if (title) {
        title.textContent = 'House Advance available';
      }
      if (message) {
        message.textContent = `${money(houseAdvanceConfig.amount)} can be added to this profile. Future net wins repay 10%.`;
      }
      this.elements.houseAdvanceButton.classList.remove('hidden');
      this.elements.houseAdvanceButton.disabled = false;
      return;
    }

    if (title) {
      title.textContent = 'House Advance unavailable';
    }
    if (message) {
      message.textContent = isHouseAdvanceCapped(profile)
        ? `Another House Advance is unavailable until the current ${money(profile.houseAdvance.outstandingBalance)} balance is repaid.`
        : 'House Advance is not available for this profile right now.';
    }
    this.elements.houseAdvanceButton.classList.add('hidden');
  }
}
