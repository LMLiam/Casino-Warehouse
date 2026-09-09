/**
 * Debug and admin control elements.
 * Only visible/functional when admin token is provided.
 */
export interface DebugElements {
  /** Admin token input field */
  readonly adminTokenInput: HTMLInputElement;

  /** Authorize as admin button */
  readonly authorizeAdminButton: HTMLButtonElement;

  /** Reset all game state button */
  readonly resetAllButton: HTMLButtonElement;

  /** Clear all saved data button */
  readonly clearSavesButton: HTMLButtonElement;
}
