/**
 * Slot machine game elements including reels, controls, and multiplayer features.
 */
export interface SlotsElements {
  /** Slot machine view container */
  readonly slotsView: HTMLDivElement;

  /** Game title display */
  readonly slotsTitle: HTMLElement;

  /** Wager input field */
  readonly slotsWager: HTMLInputElement;

  /** Confirm wager button */
  readonly slotsWagerButton: HTMLButtonElement;

  /** Mark ready for spin button */
  readonly slotsReadyButton: HTMLButtonElement;

  /** Spin reel button */
  readonly slotsSpinButton: HTMLButtonElement;

  /** Bonus pick selection buttons */
  readonly bonusPickButtons: HTMLButtonElement[];

  /** Action control buttons container */
  readonly slotsControls: HTMLDivElement;

  /** Rules reference panel */
  readonly slotsRules: HTMLElement;

  /** Payout table reference panel */
  readonly slotsPaytable: HTMLElement;

  /** Game status message */
  readonly slotsStatus: HTMLElement;

  /** Reel animation container */
  readonly slotReels: HTMLElement;

  /** Spin result display */
  readonly slotsResult: HTMLElement;

  /** Room players list for multiplayer slots */
  readonly slotsRoomPlayers: HTMLElement;
}
