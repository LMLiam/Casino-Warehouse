/**
 * Main layout and HUD (heads-up display) elements.
 * Handles screen sections, navigation, and common controls.
 */
export interface LayoutElements {
  /** Main app shell container */
  readonly shell: HTMLElement;

  /** Connection overlay (for offline/connecting states) */
  readonly connectionOverlay: HTMLElement;

  /** Game lobby view container */
  readonly gameLobby: HTMLDivElement;

  /** Game lobby tile grid */
  readonly gameLobbyTiles: HTMLDivElement;

  /** Game/view tab buttons */
  readonly gameTabs: HTMLButtonElement[];

  /** Player information strip */
  readonly playerStrip: HTMLDivElement;

  /** House Advance panel */
  readonly houseAdvancePanel: HTMLDivElement;

  /** House Advance advance button */
  readonly houseAdvanceButton: HTMLButtonElement;

  /** Main game HUD container */
  readonly gameHud: HTMLDivElement;

  /** HUD overflow menu for additional controls */
  readonly hudOverflowMenu: HTMLDetailsElement;

  /** Action dock with game-specific buttons */
  readonly actionDock: HTMLDivElement;

  /** Deal button (Beat the House) */
  readonly dealButton: HTMLButtonElement;

  /** Next round button (Beat the House) */
  readonly nextButton: HTMLButtonElement;

  /** Hit button (Beat the House) */
  readonly hitButton: HTMLButtonElement;

  /** Stick/stand button (Beat the House) */
  readonly stickButton: HTMLButtonElement;

  /** Rebet last wager button */
  readonly rebetButton: HTMLButtonElement;

  /** Clear wager button */
  readonly clearButton: HTMLButtonElement;

  /** Layout customization overlay button */
  readonly layoutOverlayButton: HTMLButtonElement;

  /** Game activity log */
  readonly log: HTMLDivElement;
}
