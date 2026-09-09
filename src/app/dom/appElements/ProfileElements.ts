/**
 * Profile setup and management elements.
 * Handles profile creation, selection, and session configuration.
 */
export interface ProfileElements {
  /** Setup view container */
  readonly setup: HTMLElement;

  /** Profile name input field */
  readonly profileNameInput: HTMLInputElement;

  /** Create new profile button */
  readonly createProfileButton: HTMLButtonElement;

  /** List of available profiles */
  readonly profileList: HTMLDivElement;

  /** Start session button */
  readonly startSessionButton: HTMLButtonElement;

  /** Profile save status indicator */
  readonly saveStatus: HTMLElement;

  /** Switch to different profile button */
  readonly switchProfileButton: HTMLButtonElement;

  /** Session wager limit input */
  readonly sessionLimitInput: HTMLInputElement;

  /** Session limit warning/notice display */
  readonly sessionNotice: HTMLElement;

  /** Profile statistics display */
  readonly profileStats: HTMLElement;

  /** Audit/activity log display */
  readonly auditLog: HTMLDivElement;
}
