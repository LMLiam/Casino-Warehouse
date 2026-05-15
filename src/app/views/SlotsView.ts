import { slotFrameAsset } from '../../assets/manifest/slotFrameAsset';
import { slotSymbolAsset } from '../../assets/manifest/slotSymbolAsset';
import type { CasinoGameId } from '../../game/ids';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import { symbolLabel } from '../../game/slots/symbolLabel';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements/AppElements';
import { money } from '../format/appMoney';

export class SlotsView {
  private static readonly spinAnimationMs = 1280;
  private static readonly reelDelayStepMs = 42;
  private static readonly reelShineBaseDelayMs = 120;
  private static readonly reelShineStepDelayMs = 34;

  private spinTimer: number | undefined;

  public constructor(private readonly elements: AppElements) {}

  public playSpinAnimation(): void {
    window.clearTimeout(this.spinTimer);
    this.elements.slotReels.classList.remove('is-spinning');
    void this.elements.slotReels.offsetWidth;
    this.elements.slotReels.classList.add('is-spinning');
    this.spinTimer = window.setTimeout(() => {
      this.elements.slotReels.classList.remove('is-spinning');
    }, SlotsView.spinAnimationMs);
  }

  public render(snapshot: SlotSnapshot, activeGame: CasinoGameId, activeRoom?: RoomSnapshot, profileId = ''): void {
    this.elements.slotsTitle.textContent = snapshot.themeTitle;
    this.elements.slotsView.classList.toggle('slot-win', snapshot.returned > 0);
    this.elements.slotsView.classList.toggle('slot-bonus', snapshot.phase === 'bonus' || snapshot.bonusBank > 0);
    this.elements.slotsView.classList.toggle('slot-jackpot', Boolean(snapshot.jackpotWin));
    this.elements.slotsView.style.setProperty('--slot-frame-art', `url('${slotFrameAsset(snapshot.themeId).path}')`);
    this.elements.slotReels.style.setProperty('--slot-column-count', String(snapshot.columns));
    this.elements.slotReels.style.setProperty('--slot-row-count', String(snapshot.rows));
    this.elements.slotsStatus.textContent = snapshot.status;
    this.elements.slotReels.replaceChildren();
    snapshot.reels.forEach((symbol, index) => {
      const row = Math.floor(index / snapshot.columns) + 1;
      const column = (index % snapshot.columns) + 1;
      const label = symbolLabel(symbol);
      const symbolAsset = slotSymbolAsset(symbol);

      const reelCell = document.createElement('span');
      reelCell.style.setProperty('--reel-delay', `${index * SlotsView.reelDelayStepMs}ms`);
      reelCell.style.setProperty('--reel-shine-delay', `${SlotsView.reelShineBaseDelayMs + index * SlotsView.reelShineStepDelayMs}ms`);
      reelCell.setAttribute('aria-label', `Column ${column}, row ${row}: ${label}`);
      reelCell.setAttribute('data-slot-symbol', String(symbol));
      reelCell.setAttribute('data-slot-column', String(column));
      reelCell.setAttribute('data-slot-row', String(row));

      const symbolImage = document.createElement('img');
      symbolImage.className = 'slot-symbol-img';
      symbolImage.src = symbolAsset.path;
      symbolImage.alt = '';
      symbolImage.draggable = false;

      reelCell.append(symbolImage);
      this.elements.slotReels.append(reelCell);
    });
    this.elements.slotsResult.textContent = `${snapshot.jackpotWin ? `${snapshot.jackpotWin.label} • ` : ''}Line ${money(snapshot.lineWin)} • Bonus ${money(snapshot.bonusBank)} • Free spins ${snapshot.freeSpinsRemaining} • Returned ${money(snapshot.returned)}`;

    if (activeRoom?.slots && activeRoom.gameId === activeGame) {
      this.renderRoomPlayers(snapshot, activeRoom, profileId);
    } else {
      this.renderSoloControls(snapshot);
    }
    this.elements.bonusPickButtons.forEach((button) => this.setActionButton(button, snapshot.phase === 'bonus' && snapshot.bonusPicksRemaining > 0));
  }

  private renderRoomPlayers(snapshot: SlotSnapshot, activeRoom: RoomSnapshot, profileId: string): void {
    const readyCount = activeRoom.slots?.readyProfileIds.length ?? 0;
    const myWager = activeRoom.slots?.wagersByProfileId[profileId] ?? 0;
    const canPlay = activeRoom.players.some((roomPlayer) => roomPlayer.profileId === profileId);
    this.elements.slotsStatus.textContent = `${snapshot.status} Shared room ready ${readyCount}/${activeRoom.players.length}.`;
    this.elements.slotsRoomPlayers.classList.remove('hidden');
    this.elements.slotsRoomPlayers.innerHTML = activeRoom.players
      .map((roomPlayer) => {
        const wager = activeRoom.slots?.wagersByProfileId[roomPlayer.profileId] ?? 0;
        const ready = activeRoom.slots?.readyProfileIds.includes(roomPlayer.profileId) ?? false;
        const returned = activeRoom.slots?.returnedByProfileId?.[roomPlayer.profileId] ?? 0;
        const mine = roomPlayer.profileId === profileId ? ' mine' : '';
        return `
          <article class="slots-player${mine}">
            <b>${escapeHtml(roomPlayer.profileName)}</b>
            <span>${wager > 0 ? `Wager ${money(wager)}` : 'No wager'}</span>
            <strong>${snapshot.phase === 'spun' ? 'Spun' : ready ? 'Ready' : 'Waiting'}</strong>
            <small>Paid ${money(returned)}</small>
          </article>
        `;
      })
      .join('');
    this.setActionButton(this.elements.slotsWagerButton, snapshot.phase !== 'bonus' && canPlay);
    this.setActionButton(
      this.elements.slotsReadyButton,
      snapshot.phase !== 'bonus' && canPlay && myWager > 0 && !activeRoom.slots?.readyProfileIds.includes(profileId),
    );
    this.setActionButton(this.elements.slotsSpinButton, snapshot.phase !== 'bonus' && canPlay && readyCount >= activeRoom.players.length);
  }

  private renderSoloControls(snapshot: SlotSnapshot): void {
    this.elements.slotsRoomPlayers.classList.add('hidden');
    this.elements.slotsRoomPlayers.innerHTML = '';
    this.setActionButton(this.elements.slotsWagerButton, false);
    this.setActionButton(this.elements.slotsReadyButton, false);
    this.setActionButton(this.elements.slotsSpinButton, snapshot.phase !== 'bonus');
  }

  private setActionButton(button: HTMLButtonElement, visible: boolean): void {
    button.disabled = !visible;
    button.classList.toggle('hidden', !visible);
  }
}
