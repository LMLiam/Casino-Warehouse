/**
 * Audio control elements for volume and muting.
 * Used by AudioControls to bind event listeners and persist settings.
 */
export interface AudioElements {
  /** Master mute toggle affecting all audio */
  readonly muteToggle: HTMLInputElement;
  /** Master volume fader (0-100) */
  readonly masterVolume: HTMLInputElement;
  /** Background music volume fader */
  readonly musicVolume: HTMLInputElement;
  /** Sound effects volume fader */
  readonly effectsVolume: HTMLInputElement;
  /** Card dealing sound volume fader */
  readonly dealingVolume: HTMLInputElement;
  /** Chip stack sound volume fader */
  readonly chipsVolume: HTMLInputElement;
  /** Slot machine sound volume fader */
  readonly slotsVolume: HTMLInputElement;
  /** Win announcement sound volume fader */
  readonly winsVolume: HTMLInputElement;
  /** Bonus feature sound volume fader */
  readonly bonusVolume: HTMLInputElement;
  /** UI interaction sound volume fader */
  readonly uiVolume: HTMLInputElement;
  /** Ambience sound volume fader */
  readonly ambienceVolume: HTMLInputElement;
}
