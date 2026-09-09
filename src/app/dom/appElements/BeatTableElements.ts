/**
 * Beat the House game table elements.
 * Includes shoe status, seat status, controls, and rules display.
 */
export interface BeatTableElements {
  /** Settlement result announcement area */
  readonly beatSettlementAnnouncement: HTMLElement;

  /** Current player seat status display */
  readonly beatSeatStatus: HTMLDivElement;

  /** Shoe composition status display */
  readonly beatShoeStatus: HTMLDivElement;

  /** Label for shoe status (shows card count) */
  readonly beatShoeLabel: HTMLElement;

  /** Remaining card count display */
  readonly beatShoeCounts: HTMLElement;

  /** Visual progress meter for shoe burn */
  readonly beatShoeMeter: HTMLMeterElement;

  /** Cut card position indicator */
  readonly beatShoeCut: HTMLElement;

  /** Cut card hint/cue element */
  readonly beatShoeCue: HTMLElement;

  /** Overall table status and phase display */
  readonly beatTableStatus: HTMLElement;

  /** Action buttons container (deal, next, etc.) */
  readonly beatControls: HTMLDivElement;

  /** Rules reference panel */
  readonly beatRules: HTMLElement;

  /** Payout table reference panel */
  readonly beatPaytable: HTMLElement;

  /** Half-chip indicator for side bet display */
  readonly beatHalfChipIndicator: HTMLElement;
}
