/**
 * Multiplayer room browser and hosting elements.
 * Handles room creation, joining, and management.
 */
export interface RoomElements {
  /** Room lobby/browser view container */
  readonly roomLobby: HTMLDivElement;

  /** Currently selected room title */
  readonly roomGameTitle: HTMLElement;

  /** Currently selected room description */
  readonly roomGameDescription: HTMLElement;

  /** Return to game lobby button */
  readonly backToLobbyButton: HTMLButtonElement;

  /** Room browser container */
  readonly roomBrowser: HTMLDivElement;

  /** Room name input field */
  readonly roomNameInput: HTMLInputElement;

  /** Max players input field */
  readonly roomMaxPlayersInput: HTMLInputElement;

  /** Refresh room list button */
  readonly roomRefreshButton: HTMLButtonElement;

  /** Create/host new room button */
  readonly hostRoomButton: HTMLButtonElement;

  /** Leave current room button */
  readonly leaveRoomButton: HTMLButtonElement;

  /** Room connection status */
  readonly roomStatus: HTMLElement;

  /** Room settings menu */
  readonly roomMenu: HTMLDetailsElement;

  /** Player seats layout */
  readonly roomSeats: HTMLElement;

  /** Table/game host container */
  readonly tableHost: HTMLDivElement;
}
