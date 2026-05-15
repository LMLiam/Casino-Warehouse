import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements/AppElements';
import type { CasinoPlayer } from '../state/casinoPlayer/CasinoPlayer';

export class PlayerStripView {
  public constructor(private readonly elements: AppElements) {}

  public render(player: CasinoPlayer | undefined): void {
    this.elements.playerStrip.innerHTML = player ? `<span class="player-strip-profile">${escapeHtml(player.name)}</span>` : '';
  }
}
