import type { BetType } from '../../game/types/BetType';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import type { AppElements } from '../dom/appElements/AppElements';
import { money } from '../format/appMoney';
import { isBeatSnapshot } from '../state/appSnapshots/isBeatSnapshot';
import { totalOnTable } from '../state/appSnapshots/totalOnTable';

export class BeatControlsView {
  private pendingMainBet = false;
  private pendingAnyBet = false;
  private pendingStartRound = false;

  public constructor(private readonly elements: AppElements) {}

  public markPendingBet(betType: BetType): void {
    this.pendingAnyBet = true;
    this.setActionButton(this.elements.rebetButton, false);
    if (betType !== 'main') {
      return;
    }
    this.pendingMainBet = true;
    this.setActionButton(this.elements.dealButton, true);
    this.setActionButton(this.elements.clearButton, true);
  }

  public queueStartRound(): void {
    this.pendingStartRound = true;
    this.elements.status.textContent = 'Confirming main bet before dealing.';
  }

  public shouldQueueStartRound(room: RoomSnapshot | undefined): boolean {
    if (!room || !isBeatSnapshot(room.game) || room.game.phase !== 'betting') {
      return false;
    }
    return !this.hasMainBet(room.game) && this.pendingMainBet;
  }

  public clearPending(): void {
    this.pendingMainBet = false;
    this.pendingAnyBet = false;
    this.pendingStartRound = false;
  }

  public render(snapshot: GameSnapshot, isBeatTheHouse: boolean, onConfirmedStartRound: () => void, controlsAvailable = true): void {
    this.elements.status.textContent = snapshot.status;
    const wageredOnTable = totalOnTable(snapshot);
    const hasMainBet = this.hasMainBet(snapshot);
    if (snapshot.phase !== 'betting') {
      this.clearPending();
    }
    if (this.totalBet(snapshot.bets) > 0) {
      this.pendingAnyBet = false;
    }
    if (hasMainBet) {
      this.pendingMainBet = false;
      if (this.pendingStartRound) {
        this.pendingStartRound = false;
        onConfirmedStartRound();
      }
    }
    this.elements.onTable.textContent = money(wageredOnTable);
    this.setActionButton(this.elements.dealButton, controlsAvailable && snapshot.phase === 'betting' && (hasMainBet || this.pendingMainBet));
    this.setActionButton(this.elements.rebetButton, controlsAvailable && snapshot.canRebet && !this.pendingAnyBet);
    this.setActionButton(this.elements.clearButton, controlsAvailable && snapshot.phase === 'betting' && (wageredOnTable > 0 || this.pendingMainBet));
    this.setActionButton(this.elements.nextButton, controlsAvailable && snapshot.phase === 'roundOver');
    this.setActionButton(this.elements.hitButton, controlsAvailable && snapshot.phase === 'playing');
    this.setActionButton(this.elements.stickButton, controlsAvailable && snapshot.phase === 'playing');
    this.elements.chipRail.classList.toggle('hidden', !isBeatTheHouse || snapshot.phase !== 'betting' || !controlsAvailable);
  }

  private hasMainBet(snapshot: GameSnapshot): boolean {
    return Object.values(snapshot.bets).some((bet) => bet.main > 0);
  }

  private totalBet(snapshotBets: GameSnapshot['bets']): number {
    return Object.values(snapshotBets).reduce((sum, handBets) => sum + Object.values(handBets).reduce((handSum, amount) => handSum + amount, 0), 0);
  }

  private setActionButton(button: HTMLButtonElement, visible: boolean): void {
    button.disabled = !visible;
    button.classList.toggle('hidden', !visible);
  }
}
