export class BeatChipSelection {
  private selectedChip = 0;
  private availableCredits: number | undefined;

  public constructor(
    private readonly chipButtons: readonly HTMLButtonElement[],
    private readonly table: { setSelectedChip(value: number): void },
  ) {}

  public get value(): number {
    return this.selectedChip;
  }

  public syncBankroll(bankroll: number | undefined, canSelectChip: boolean): void {
    this.availableCredits = bankroll;
    if (canSelectChip) {
      this.ensureSelectedAffordable(bankroll);
    }
  }

  public select(button: HTMLButtonElement): void {
    const nextChip = Number(button.dataset.chip);
    if (!this.isAffordable(nextChip)) {
      this.clear();
      return;
    }
    this.selectedChip = nextChip;
    this.chipButtons.forEach((chipButton) => chipButton.classList.toggle('selected', chipButton === button));
    this.table.setSelectedChip(this.selectedChip);
  }

  public ensureAmountAffordable(amount: number): boolean {
    if (this.isAffordable(amount)) {
      return true;
    }
    this.clear();
    return false;
  }

  public ensureSelectedAffordable(bankroll = this.availableCredits): boolean {
    if (this.selectedChip <= 0 || bankroll === undefined || this.selectedChip <= bankroll) {
      return true;
    }
    this.clear();
    return false;
  }

  private isAffordable(amount: number): boolean {
    return Number.isFinite(amount) && amount > 0 && (this.availableCredits === undefined || amount <= this.availableCredits);
  }

  private clear(): void {
    this.selectedChip = 0;
    this.chipButtons.forEach((chipButton) => chipButton.classList.remove('selected'));
    this.table.setSelectedChip(0);
  }
}
