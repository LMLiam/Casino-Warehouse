import { renderTablePanel } from './renderTablePanel';

/**
 * Renders the complete HTML template for the Casino Warehouse app.
 *
 * @returns HTML for the device notice, profile setup, game shell, and connection state.
 */
export const renderTemplate = (): string => {
  const unsupportedDeviceSection = (): string => `
  <section class="unsupported-device" aria-label="Unsupported device"><div>
    <p class="eyebrow">Casino Warehouse</p><h1>Desktop or tablet required</h1>
    <p>This fictional-money casino arcade is designed for desktop and iPad/tablet screens. Please open it on a wider display.</p>
  </div></section>
`;

  const profileSetupSection = (): string => `
  <section id="setup" class="setup-screen" aria-label="Casino setup"><div class="setup-panel">
    <p class="eyebrow">Casino Warehouse</p><h1>Load profiles</h1>
    <div class="profile-create"><label>New profile <input id="profileNameInput" type="text" maxlength="32" placeholder="Player name" /></label>
      <button id="createProfileBtn" class="primary" type="button">Create</button></div>
    <div id="profileList" class="profile-list" aria-label="Saved profiles"></div>
    <button id="startSessionBtn" class="primary" type="button">Start Profile Session</button>
    <div id="setupRadixDialogs"></div><p id="saveStatus" class="save-status" role="status"></p>
  </div></section>
`;

  const gameShell = (): string => `<main id="casinoShell" class="game-shell hidden">${renderTablePanel()}</main>`;
  const connectionOverlay = (): string => `
  <section id="connectionOverlay" class="connection-overlay hidden" aria-live="assertive" aria-label="Game connection"><div>
    <p class="eyebrow">Connection interrupted</p><h2>Reconnecting</h2>
    <p>Actions are paused while the server connection is restored.</p>
  </div></section>
`;

  return `${unsupportedDeviceSection()}${profileSetupSection()}${gameShell()}${connectionOverlay()}`;
};
