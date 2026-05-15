import type { BetType } from '../../game/types/BetType';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import { money } from '../format/appMoney';
import { isBeatSnapshot } from '../state/appSnapshots/isBeatSnapshot';
import { totalOnTable } from '../state/appSnapshots/totalOnTable';

export class BeatControlsView {
  private pendingMainBet = false;
  private pendingAnyBet = false;
  private pendingStartRound = false;

  public constructor(
    private readonly elements: {
      readonly status: { textContent: string | null };
      readonly onTable: { textContent: string | null };
      readonly chipRail: { classList: Pick<DOMTokenList, 'toggle'> };
      readonly dealButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
      readonly rebetButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
      readonly clearButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
      readonly nextButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
      readonly hitButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
      readonly stickButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
    },
  ) {}

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

  public render(
    snapshot: GameSnapshot,
    isBeatTheHouse: boolean,
    onConfirmedStartRound: () => void,
    controlsAvailable = true,
    activeRoom?: RoomSnapshot,
    profileId?: string,
    bankroll?: number,
  ): void {
    this.elements.status.textContent = snapshot.status;
    const wageredOnTable = totalOnTable(snapshot);
    const activeHandId = activeRoom ? this.activeHandId(activeRoom, profileId) : undefined;
    const currentProfileWagered = activeRoom ? (activeHandId ? this.totalHandBet(snapshot.bets[activeHandId]) : 0) : wageredOnTable;
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
    this.setActionButton(this.elements.rebetButton, controlsAvailable && this.canRebet(snapshot, activeRoom, activeHandId, bankroll) && !this.pendingAnyBet);
    this.setActionButton(this.elements.clearButton, controlsAvailable && snapshot.phase === 'betting' && (currentProfileWagered > 0 || this.pendingMainBet));
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

  private totalHandBet(handBets: GameSnapshot['bets'][keyof GameSnapshot['bets']]): number {
    return Object.values(handBets).reduce((total, amount) => total + amount, 0);
  }

  private activeHandId(room: RoomSnapshot, profileId: string | undefined): keyof GameSnapshot['bets'] | undefined {
    const seatId = room.seats.find((seat) => seat.profileId === profileId)?.seatId;
    return seatId === 'left' || seatId === 'centre' || seatId === 'right' ? seatId : undefined;
  }

  private canRebet(
    snapshot: GameSnapshot,
    activeRoom: RoomSnapshot | undefined,
    activeHandId: keyof GameSnapshot['bets'] | undefined,
    bankroll: number | undefined,
  ): boolean {
    if (!activeRoom) {
      return snapshot.canRebet;
    }
    if (!activeHandId || snapshot.phase !== 'betting' || this.totalHandBet(snapshot.bets[activeHandId]) > 0) {
      return false;
    }
    const rebetAmount = snapshot.rebetAmounts[activeHandId];
    return rebetAmount > 0 && (bankroll ?? 0) >= rebetAmount;
  }

  private setActionButton(button: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> }, visible: boolean): void {
    button.disabled = !visible;
    button.classList.toggle('hidden', !visible);
  }
}
