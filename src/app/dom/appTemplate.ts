export const renderTemplate = (): string => `
  <section class="unsupported-device" aria-label="Unsupported device">
    <div>
      <p class="eyebrow">Casino Warehouse</p>
      <h1>Desktop or tablet required</h1>
      <p>This fictional-money casino arcade is designed for desktop and iPad/tablet screens. Please open it on a wider display.</p>
    </div>
  </section>
  <section id="setup" class="setup-screen" aria-label="Casino setup">
    <div class="setup-panel">
      <p class="eyebrow">Casino Warehouse</p>
      <h1>Load profiles</h1>
      <div class="profile-create">
        <label>
          New profile
          <input id="profileNameInput" type="text" maxlength="32" placeholder="Player name" />
        </label>
        <button id="createProfileBtn" class="primary" type="button">Create</button>
      </div>
      <div id="profileList" class="profile-list" aria-label="Saved profiles"></div>
      <button id="startSessionBtn" class="primary" type="button">Start Profile Session</button>
      <div id="setupRadixDialogs"></div>
      <p id="saveStatus" class="save-status" role="status"></p>
    </div>
  </section>
  <main id="casinoShell" class="game-shell hidden">
    <section class="table-panel" aria-label="Casino game area">
      <div id="gameLobby" class="game-lobby">
        <div class="game-lobby-header">
          <p class="eyebrow">Game Selection</p>
          <h2>Casino Warehouse</h2>
          <p class="fictional-notice">Fictional currency only. No real money gambling.</p>
        </div>
        <div id="houseAdvancePanel" class="house-advance-panel hidden" aria-live="polite">
          <div>
            <b id="houseAdvanceTitle">House Advance</b>
            <p id="houseAdvanceMessage">£100 is available when this profile has no credits.</p>
          </div>
          <button id="houseAdvanceBtn" class="primary" type="button">Take House Advance</button>
        </div>
        <div id="gameLobbyTiles" class="game-lobby-tiles" aria-label="Available games"></div>
      </div>
      <div id="roomLobby" class="room-lobby hidden">
        <div class="room-lobby-header">
          <p class="eyebrow">Multiplayer Rooms</p>
          <h2 id="roomGameTitle">Game Rooms</h2>
          <p id="roomGameDescription" class="fictional-notice"></p>
          <p id="roomStatus" class="session-notice">Choose a game to browse live rooms.</p>
        </div>
        <section class="room-create" aria-label="Create multiplayer room">
          <label>Room name <input id="roomNameInput" type="text" maxlength="48" placeholder="Evening table" /></label>
          <label>Max players <input id="roomMaxPlayersInput" type="number" min="1" max="8" value="3" /></label>
          <button id="hostRoomBtn" class="primary" type="button">Create Room</button>
          <button id="roomRefreshBtn" type="button">Refresh Rooms</button>
        </section>
        <div id="roomBrowser" class="room-browser" aria-live="polite"></div>
      </div>
      <div id="tableHost" class="table-host">
        <div id="beatSeatStatus" class="seat-status-overlay" aria-label="Beat the House seat status"></div>
      </div>
      <div id="beatSettlementAnnouncement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
      <div id="blackjackView" class="blackjack-table-view hidden">
        <div class="blackjack-table-felt">
          <div class="blackjack-rail">Blackjack pays 3:2 • Dealer stands on soft 17</div>
          <div class="blackjack-seat dealer-seat">
            <span>Dealer</span>
            <strong id="blackjackDealerCards" class="playing-cards"></strong>
          </div>
          <div class="blackjack-center">
            <h2>Blackjack</h2>
            <p id="blackjackStatus"></p>
            <b id="blackjackResult"></b>
          </div>
          <div id="blackjackSeats" class="blackjack-seat-grid"></div>
          <div class="blackjack-seat player-seat">
            <span>Player</span>
            <strong id="blackjackPlayerCards" class="playing-cards"></strong>
          </div>
        </div>
      </div>
      <div id="slotsView" class="mini-game-view hidden">
        <h2 id="slotsTitle">Bonus Slots</h2>
        <div id="slotReels" class="slot-reels"></div>
        <p id="slotsStatus"></p>
        <b id="slotsResult"></b>
        <div id="slotsRoomPlayers" class="slots-room-players hidden"></div>
      </div>
      <div id="gameHud" class="game-hud" aria-label="Game menus">
        <div class="hud-button-row">
          <button id="backToLobbyBtn" class="hud-button primary" type="button">Home</button>
        </div>
        <div class="hud-button-row hud-button-row-right">
          <details id="hudOverflowMenu" class="hud-overflow-menu">
            <summary id="hudOverflowButton" aria-label="Game actions menu" title="Game actions">
              <span aria-hidden="true">...</span>
            </summary>
            <div id="hudOverflowPanel" class="hud-overflow-panel" aria-label="Secondary game actions">
              <div class="hud-overflow-actions">
                <button id="switchProfileBtn" class="hud-overflow-action" type="button">Switch Profile</button>
                <button id="leaveRoomBtn" class="hud-overflow-action hidden" type="button">Exit Room</button>
              </div>
              <details class="hud-overflow-section" data-hud-section="info">
                <summary>Info</summary>
                <div class="rules-menu-stack">
                  <div id="beatRules"></div>
                  <div id="blackjackRules"></div>
                  <div id="slotsRules"></div>
                  <div id="beatPaytable"></div>
                  <div id="blackjackPaytable"></div>
                  <div id="slotsPaytable"></div>
                </div>
              </details>
              <details class="hud-overflow-section" data-hud-section="profile">
                <summary>Profile</summary>
                <div id="playerStrip" class="player-strip" aria-label="Active profile"></div>
              </details>
              <details id="roomMenu" class="hud-overflow-section room-menu hidden" data-hud-section="room">
                <summary>Room</summary>
                <div id="roomSeats" class="room-seats">No active room.</div>
              </details>
              <details class="hud-overflow-section stats-menu" data-hud-section="stats">
                <summary>Stats</summary>
                <div class="stats-menu-content">
                  <small id="profileStats"></small>
                  <small>Beat the House table: <b id="onTable">£0</b></small>
                  <p id="sessionNotice" class="session-notice">Session wagered £0 / no limit. Fictional currency only.</p>
                </div>
              </details>
              <details class="admin-panel hud-overflow-section" data-hud-section="admin">
                <summary>Admin</summary>
                <div class="admin-menu-content">
                  <label>
                    Admin token
                    <input id="adminTokenInput" type="password" autocomplete="off" />
                  </label>
                  <button id="authorizeAdminBtn" type="button">Unlock Admin</button>
                  <label>
                    Add bankroll
                    <input id="moneyInput" type="number" min="1" value="1000" />
                  </label>
                  <div class="admin-actions">
                    <button id="addMoneyBtn" type="button">Add</button>
                    <button id="subtractMoneyBtn" type="button">Subtract</button>
                    <button id="resetMoneyBtn" type="button">Reset £1,000</button>
                    <button id="resetAllBtn" type="button">Reset All</button>
                    <button id="clearSavesBtn" type="button">Clear Saves</button>
                    <button id="layoutOverlayBtn" type="button">Layout Overlay</button>
                  </div>
                  <details class="log-panel">
                    <summary>Game Log</summary>
                    <div id="log"></div>
                  </details>
                  <details class="log-panel">
                    <summary>Audit</summary>
                    <div id="auditLog"></div>
                  </details>
                  <details class="log-panel">
                    <summary>Responsible Play</summary>
                    <label>
                      Session wager limit
                      <input id="sessionLimitInput" type="number" min="0" value="0" />
                    </label>
                  </details>
                </div>
              </details>
            </div>
          </details>
        </div>
      </div>
      <div class="wallet-stack">
        <div id="moneyPill" class="money-pill" aria-label="Player balance">
          <span>Balance</span>
          <div class="bankroll-line">
            <strong id="bankroll">£1,000</strong>
            <em id="bankrollDelta" aria-live="polite"></em>
          </div>
          <small id="houseAdvancePill" class="hidden"></small>
        </div>
        <div id="beatHalfChipIndicator" class="beat-half-chip-indicator hidden" role="status" aria-live="polite" aria-label="Beat the House half-chip balance">
          Half chip: one half
        </div>
      </div>
      <div id="actionDock" class="action-dock" aria-label="Game actions">
        <div id="beatControls" class="game-controls">
          <div class="action-grid">
            <button id="dealBtn" class="primary" type="button">Deal</button>
            <button id="nextBtn" type="button">Next Round</button>
            <button id="hitBtn" type="button">Hit</button>
            <button id="stickBtn" type="button">Stick</button>
            <button id="rebetBtn" type="button">Rebet</button>
            <button id="clearBtn" type="button">Clear Bets</button>
          </div>
        </div>
        <div id="blackjackControls" class="game-controls hidden">
          <label>Wager <input id="blackjackWager" type="number" min="1" value="25" /></label>
          <div class="action-grid">
            <button id="blackjackDealBtn" class="primary" type="button">Deal</button>
            <button id="blackjackNewBtn" type="button">New Hand</button>
            <button id="blackjackHitBtn" type="button">Hit</button>
            <button id="blackjackStandBtn" type="button">Stand</button>
            <button id="blackjackDoubleBtn" type="button">Double</button>
            <button id="blackjackSplitBtn" type="button">Split</button>
            <button id="blackjackInsuranceBtn" type="button">Insurance</button>
          </div>
        </div>
        <div id="slotsControls" class="game-controls hidden">
          <label>Wager <input id="slotsWager" type="number" min="1" value="10" /></label>
          <div class="action-grid">
            <button id="slotsWagerBtn" type="button">Set Wager</button>
            <button id="slotsReadyBtn" type="button">Ready</button>
            <button id="slotsSpinBtn" class="primary" type="button">Spin</button>
          </div>
          <div class="bonus-grid">
            <button type="button" data-bonus-pick>Pick</button>
            <button type="button" data-bonus-pick>Pick</button>
            <button type="button" data-bonus-pick>Pick</button>
            <button type="button" data-bonus-pick>Pick</button>
          </div>
        </div>
      </div>
      <div id="chipRail" class="chip-rail" role="group" aria-label="Chip selection"></div>
    </section>
  </main>
  <section id="connectionOverlay" class="connection-overlay hidden" aria-live="assertive" aria-label="Game connection">
    <div>
      <p class="eyebrow">Connection interrupted</p>
      <h2>Reconnecting</h2>
      <p>Actions are paused while the server connection is restored.</p>
    </div>
  </section>
`;
