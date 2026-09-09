/**
 * Blackjack game elements including table, cards, controls, and player seats.
 */
export interface BlackjackElements {
  /** Blackjack table container */
  readonly blackjackView: HTMLDivElement;

  /** Action control buttons (hit, stand, double, split, etc.) */
  readonly blackjackControls: HTMLDivElement;

  /** Rules reference panel */
  readonly blackjackRules: HTMLElement;

  /** Payout table reference panel */
  readonly blackjackPaytable: HTMLElement;

  /** Current game status message */
  readonly blackjackStatus: HTMLElement;

  /** Player's hole cards display */
  readonly blackjackPlayerCards: HTMLElement;

  /** Dealer's hole cards display */
  readonly blackjackDealerCards: HTMLElement;

  /** Hand result (win/loss/push) display */
  readonly blackjackResult: HTMLElement;

  /** Multiplayer seat layout */
  readonly blackjackSeats: HTMLElement;

  /** Wager input field */
  readonly blackjackWager: HTMLInputElement;

  /** Deal button */
  readonly blackjackDealButton: HTMLButtonElement;

  /** Hit button */
  readonly blackjackHitButton: HTMLButtonElement;

  /** Stand button */
  readonly blackjackStandButton: HTMLButtonElement;

  /** Double down button */
  readonly blackjackDoubleButton: HTMLButtonElement;

  /** Split pairs button */
  readonly blackjackSplitButton: HTMLButtonElement;

  /** Insurance button */
  readonly blackjackInsuranceButton: HTMLButtonElement;

  /** New hand button */
  readonly blackjackNewButton: HTMLButtonElement;
}
