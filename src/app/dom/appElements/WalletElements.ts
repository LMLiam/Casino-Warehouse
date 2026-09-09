/**
 * Wallet and bankroll display elements.
 * Shows current balance, transactions, and money management.
 */
export interface WalletElements {
  /** Wallet/stack display container */
  readonly walletStack: HTMLDivElement;

  /** Current bankroll display pill */
  readonly moneyPill: HTMLDivElement;

  /** Player's current bankroll amount */
  readonly bankroll: HTMLElement;

  /** Bankroll change indicator (win/loss) */
  readonly bankrollDelta: HTMLElement;

  /** Credits on table display */
  readonly onTable: HTMLElement;

  /** Amount won/lost indicator */
  readonly houseAdvancePill: HTMLElement;

  /** Active chip amount display */
  readonly chipRail: HTMLDivElement;

  /** Chip denomination buttons for betting */
  readonly chipButtons: HTMLButtonElement[];

  /** Money input field for manual entry */
  readonly moneyInput: HTMLInputElement;

  /** Add money to bankroll button */
  readonly addMoneyButton: HTMLButtonElement;

  /** Subtract money from bankroll button */
  readonly subtractMoneyButton: HTMLButtonElement;

  /** Reset bankroll to default button */
  readonly resetMoneyButton: HTMLButtonElement;
}
