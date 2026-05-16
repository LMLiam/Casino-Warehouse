import type { BeatTheHouseChipTarget } from '../../game/types/BeatTheHouseChipTarget';
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
      readonly chipButtons: readonly {
        disabled: boolean;
        draggable: boolean;
        readonly dataset: DOMStringMap;
        readonly classList: Pick<DOMTokenList, 'toggle'>;
      }[];
      readonly dealButton: { disabled: boolean; textContent: string | null; classList: Pick<DOMTokenList, 'toggle'> };
      readonly rebetButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
      readonly clearButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
      readonly nextButton: { disabled: boolean; textContent: string | null; classList: Pick<DOMTokenList, 'toggle'> };
      readonly hitButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
      readonly stickButton: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> };
    },
    private readonly onChipBankrollChange: (bankroll: number | undefined, canSelectChip: boolean) => void = () => undefined,
  ) {}

  public markPendingBet(chipTarget: BeatTheHouseChipTarget): void {
    this.pendingAnyBet = true;
    this.setActionButton(this.elements.rebetButton, false);
    if (chipTarget !== 'main') {
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
    this.elements.status.textContent = this.roomReadyStatus(snapshot, activeRoom, profileId) ?? snapshot.status;
    const wageredOnTable = totalOnTable(snapshot);
    const activeHandId = activeRoom ? this.activeHandId(activeRoom, profileId) : undefined;
    const currentProfileWagered = activeRoom ? (activeHandId ? this.totalHandTableCredits(snapshot, activeHandId) : 0) : wageredOnTable;
    const hasMainBet = this.hasMainBet(snapshot);
    const profileReady = Boolean(profileId && activeRoom?.beat?.readyProfileIds.includes(profileId));
    if (snapshot.phase !== 'betting') {
      this.clearPending();
    }
    if (wageredOnTable > 0) {
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
    this.elements.dealButton.textContent = activeRoom ? (profileReady && snapshot.phase === 'betting' ? 'Waiting to Deal' : 'Ready to Deal') : 'Deal';
    this.elements.nextButton.textContent = activeRoom ? (profileReady && snapshot.phase === 'roundOver' ? 'Waiting Next' : 'Ready for Next') : 'Next Round';
    this.setActionButton(this.elements.dealButton, controlsAvailable && snapshot.phase === 'betting' && (hasMainBet || this.pendingMainBet) && !profileReady);
    this.setActionButton(this.elements.rebetButton, controlsAvailable && this.canRebet(snapshot, activeRoom, activeHandId, bankroll) && !this.pendingAnyBet);
    this.setActionButton(this.elements.clearButton, controlsAvailable && snapshot.phase === 'betting' && (currentProfileWagered > 0 || this.pendingMainBet));
    this.setActionButton(this.elements.nextButton, controlsAvailable && snapshot.phase === 'roundOver' && !profileReady);
    this.setActionButton(this.elements.hitButton, controlsAvailable && snapshot.phase === 'playing');
    this.setActionButton(this.elements.stickButton, controlsAvailable && snapshot.phase === 'playing');
    const hasAffordableChip = this.renderAffordableChips(bankroll);
    this.elements.chipRail.classList.toggle('hidden', !isBeatTheHouse || snapshot.phase !== 'betting' || !controlsAvailable || !hasAffordableChip);
    this.onChipBankrollChange(bankroll, controlsAvailable && snapshot.phase === 'betting');
  }

  private renderAffordableChips(bankroll: number | undefined): boolean {
    const maximumChipValue = bankroll ?? Number.POSITIVE_INFINITY;
    let hasAffordableChip = false;
    this.elements.chipButtons.forEach((button) => {
      const chipValue = Number(button.dataset.chip);
      const affordable = Number.isFinite(chipValue) && chipValue > 0 && chipValue <= maximumChipValue;
      button.disabled = !affordable;
      button.draggable = affordable;
      button.classList.toggle('hidden', !affordable);
      hasAffordableChip ||= affordable;
    });
    return hasAffordableChip;
  }

  private hasMainBet(snapshot: GameSnapshot): boolean {
    return Object.values(snapshot.bets).some((bet) => bet.main > 0);
  }

  private totalHandBet(handBets: GameSnapshot['bets'][keyof GameSnapshot['bets']]): number {
    return Object.values(handBets).reduce((total, amount) => total + amount, 0);
  }

  private totalHandTableCredits(snapshot: GameSnapshot, handId: keyof GameSnapshot['bets']): number {
    return this.totalHandBet(snapshot.bets[handId]) + snapshot.dealerTips[handId];
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
    if (!activeHandId || snapshot.phase !== 'betting' || this.totalHandTableCredits(snapshot, activeHandId) > 0) {
      return false;
    }
    const rebetAmount = snapshot.rebetAmounts[activeHandId];
    return Boolean(activeRoom.beat?.rebetSeatIds.includes(activeHandId)) && rebetAmount > 0 && (bankroll ?? 0) >= rebetAmount;
  }

  private roomReadyStatus(snapshot: GameSnapshot, activeRoom: RoomSnapshot | undefined, profileId: string | undefined): string | undefined {
    if (!activeRoom?.beat || activeRoom.gameId !== 'beat-the-house') {
      return undefined;
    }
    const readyCount = activeRoom.beat.readyCount;
    const playerCount = activeRoom.beat.playerCount;
    const profileReady = Boolean(profileId && activeRoom.beat.readyProfileIds.includes(profileId));
    if (snapshot.phase === 'betting' && activeRoom.beat.readyPhase === 'betting') {
      return profileReady ? `Ready to deal. Waiting for players ${readyCount}/${playerCount}.` : `Waiting for deal readiness ${readyCount}/${playerCount}.`;
    }
    if (snapshot.phase !== 'roundOver') {
      return undefined;
    }
    const secondsRemaining = activeRoom.beat.nextRoundDeadlineAt
      ? Math.max(0, Math.ceil((activeRoom.beat.nextRoundDeadlineAt - Date.now()) / 1000))
      : undefined;
    const countdown = secondsRemaining === undefined ? '' : ` Next round starts in ${secondsRemaining}s.`;
    return profileReady
      ? `Ready for next round. Waiting for players ${readyCount}/${playerCount}.${countdown}`
      : `Round settled. Ready for next round ${readyCount}/${playerCount}.${countdown}`;
  }

  private setActionButton(button: { disabled: boolean; classList: Pick<DOMTokenList, 'toggle'> }, visible: boolean): void {
    button.disabled = !visible;
    button.classList.toggle('hidden', !visible);
  }
}
