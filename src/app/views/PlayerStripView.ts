import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements';
import type { CasinoPlayer } from '../state/casinoPlayer';

export class PlayerStripView {
  public constructor(private readonly elements: AppElements) {}

  public render(players: readonly CasinoPlayer[], onSelect: (playerIndex: number) => void): void {
    this.elements.playerStrip.innerHTML = players
      .map((player, index) => `<button type="button" data-player="${index}">${escapeHtml(player.name)}</button>`)
      .join('');

    this.elements.playerStrip.querySelectorAll<HTMLButtonElement>('[data-player]').forEach((button) => {
      button.addEventListener('click', () => onSelect(Number(button.dataset.player)));
    });
  }
}
