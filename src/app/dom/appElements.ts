export interface AppElements {
  readonly setup: HTMLElement;
  readonly shell: HTMLElement;
  readonly connectionOverlay: HTMLElement;
  readonly profileNameInput: HTMLInputElement;
  readonly createProfileButton: HTMLButtonElement;
  readonly profileList: HTMLDivElement;
  readonly startSessionButton: HTMLButtonElement;
  readonly saveStatus: HTMLElement;
  readonly muteToggle: HTMLInputElement;
  readonly masterVolume: HTMLInputElement;
  readonly musicVolume: HTMLInputElement;
  readonly effectsVolume: HTMLInputElement;
  readonly dealingVolume: HTMLInputElement;
  readonly chipsVolume: HTMLInputElement;
  readonly slotsVolume: HTMLInputElement;
  readonly winsVolume: HTMLInputElement;
  readonly bonusVolume: HTMLInputElement;
  readonly uiVolume: HTMLInputElement;
  readonly ambienceVolume: HTMLInputElement;
  readonly gameTabs: HTMLButtonElement[];
  readonly playerStrip: HTMLDivElement;
  readonly gameLobby: HTMLDivElement;
  readonly gameLobbyTiles: HTMLDivElement;
  readonly roomLobby: HTMLDivElement;
  readonly roomGameTitle: HTMLElement;
  readonly roomGameDescription: HTMLElement;
  readonly backToLobbyButton: HTMLButtonElement;
  readonly switchProfileButton: HTMLButtonElement;
  readonly sessionLimitInput: HTMLInputElement;
  readonly sessionNotice: HTMLElement;
  readonly roomNameInput: HTMLInputElement;
  readonly roomMaxPlayersInput: HTMLInputElement;
  readonly roomRefreshButton: HTMLButtonElement;
  readonly hostRoomButton: HTMLButtonElement;
  readonly leaveRoomButton: HTMLButtonElement;
  readonly roomStatus: HTMLElement;
  readonly roomMenu: HTMLDetailsElement;
  readonly roomSeats: HTMLElement;
  readonly roomBrowser: HTMLDivElement;
  readonly tableHost: HTMLDivElement;
  readonly beatSeatStatus: HTMLDivElement;
  readonly blackjackView: HTMLDivElement;
  readonly slotsView: HTMLDivElement;
  readonly gameHud: HTMLDivElement;
  readonly moneyPill: HTMLDivElement;
  readonly actionDock: HTMLDivElement;
  readonly status: HTMLDivElement;
  readonly bankroll: HTMLElement;
  readonly bankrollDelta: HTMLElement;
  readonly profileStats: HTMLElement;
  readonly auditLog: HTMLDivElement;
  readonly onTable: HTMLElement;
  readonly log: HTMLDivElement;
  readonly chipRail: HTMLDivElement;
  readonly chipButtons: HTMLButtonElement[];
  readonly beatControls: HTMLDivElement;
  readonly blackjackControls: HTMLDivElement;
  readonly slotsControls: HTMLDivElement;
  readonly beatRules: HTMLElement;
  readonly beatPaytable: HTMLElement;
  readonly blackjackRules: HTMLElement;
  readonly blackjackPaytable: HTMLElement;
  readonly slotsRules: HTMLElement;
  readonly slotsPaytable: HTMLElement;
  readonly dealButton: HTMLButtonElement;
  readonly nextButton: HTMLButtonElement;
  readonly hitButton: HTMLButtonElement;
  readonly stickButton: HTMLButtonElement;
  readonly rebetButton: HTMLButtonElement;
  readonly clearButton: HTMLButtonElement;
  readonly addMoneyButton: HTMLButtonElement;
  readonly subtractMoneyButton: HTMLButtonElement;
  readonly resetMoneyButton: HTMLButtonElement;
  readonly resetAllButton: HTMLButtonElement;
  readonly clearSavesButton: HTMLButtonElement;
  readonly layoutOverlayButton: HTMLButtonElement;
  readonly moneyInput: HTMLInputElement;
  readonly blackjackWager: HTMLInputElement;
  readonly blackjackDealButton: HTMLButtonElement;
  readonly blackjackHitButton: HTMLButtonElement;
  readonly blackjackStandButton: HTMLButtonElement;
  readonly blackjackDoubleButton: HTMLButtonElement;
  readonly blackjackSplitButton: HTMLButtonElement;
  readonly blackjackInsuranceButton: HTMLButtonElement;
  readonly blackjackNewButton: HTMLButtonElement;
  readonly blackjackStatus: HTMLElement;
  readonly blackjackPlayerCards: HTMLElement;
  readonly blackjackDealerCards: HTMLElement;
  readonly blackjackResult: HTMLElement;
  readonly blackjackSeats: HTMLElement;
  readonly slotsTitle: HTMLElement;
  readonly slotsWager: HTMLInputElement;
  readonly slotsWagerButton: HTMLButtonElement;
  readonly slotsReadyButton: HTMLButtonElement;
  readonly slotsSpinButton: HTMLButtonElement;
  readonly bonusPickButtons: HTMLButtonElement[];
  readonly slotsStatus: HTMLElement;
  readonly slotReels: HTMLElement;
  readonly slotsResult: HTMLElement;
  readonly slotsRoomPlayers: HTMLElement;
}

export const collectElements = (): AppElements => ({
  setup: query('#setup'),
  shell: query('#casinoShell'),
  connectionOverlay: query('#connectionOverlay'),
  profileNameInput: query('#profileNameInput'),
  createProfileButton: query('#createProfileBtn'),
  profileList: query('#profileList'),
  startSessionButton: query('#startSessionBtn'),
  saveStatus: query('#saveStatus'),
  muteToggle: query('#muteToggle'),
  masterVolume: query('#masterVolume'),
  musicVolume: query('#musicVolume'),
  effectsVolume: query('#effectsVolume'),
  dealingVolume: query('#dealingVolume'),
  chipsVolume: query('#chipsVolume'),
  slotsVolume: query('#slotsVolume'),
  winsVolume: query('#winsVolume'),
  bonusVolume: query('#bonusVolume'),
  uiVolume: query('#uiVolume'),
  ambienceVolume: query('#ambienceVolume'),
  gameTabs: [...document.querySelectorAll<HTMLButtonElement>('[data-game]')],
  playerStrip: query('#playerStrip'),
  gameLobby: query('#gameLobby'),
  gameLobbyTiles: query('#gameLobbyTiles'),
  roomLobby: query('#roomLobby'),
  roomGameTitle: query('#roomGameTitle'),
  roomGameDescription: query('#roomGameDescription'),
  backToLobbyButton: query('#backToLobbyBtn'),
  switchProfileButton: query('#switchProfileBtn'),
  sessionLimitInput: query('#sessionLimitInput'),
  sessionNotice: query('#sessionNotice'),
  roomNameInput: query('#roomNameInput'),
  roomMaxPlayersInput: query('#roomMaxPlayersInput'),
  roomRefreshButton: query('#roomRefreshBtn'),
  hostRoomButton: query('#hostRoomBtn'),
  leaveRoomButton: query('#leaveRoomBtn'),
  roomStatus: query('#roomStatus'),
  roomMenu: query('#roomMenu'),
  roomSeats: query('#roomSeats'),
  roomBrowser: query('#roomBrowser'),
  tableHost: query('#tableHost'),
  beatSeatStatus: query('#beatSeatStatus'),
  blackjackView: query('#blackjackView'),
  slotsView: query('#slotsView'),
  gameHud: query('#gameHud'),
  moneyPill: query('#moneyPill'),
  actionDock: query('#actionDock'),
  status: query('#status'),
  bankroll: query('#bankroll'),
  bankrollDelta: query('#bankrollDelta'),
  profileStats: query('#profileStats'),
  auditLog: query('#auditLog'),
  onTable: query('#onTable'),
  log: query('#log'),
  chipRail: query('#chipRail'),
  chipButtons: [...document.querySelectorAll<HTMLButtonElement>('[data-chip]')],
  beatControls: query('#beatControls'),
  blackjackControls: query('#blackjackControls'),
  slotsControls: query('#slotsControls'),
  beatRules: query('#beatRules'),
  beatPaytable: query('#beatPaytable'),
  blackjackRules: query('#blackjackRules'),
  blackjackPaytable: query('#blackjackPaytable'),
  slotsRules: query('#slotsRules'),
  slotsPaytable: query('#slotsPaytable'),
  dealButton: query('#dealBtn'),
  nextButton: query('#nextBtn'),
  hitButton: query('#hitBtn'),
  stickButton: query('#stickBtn'),
  rebetButton: query('#rebetBtn'),
  clearButton: query('#clearBtn'),
  addMoneyButton: query('#addMoneyBtn'),
  subtractMoneyButton: query('#subtractMoneyBtn'),
  resetMoneyButton: query('#resetMoneyBtn'),
  resetAllButton: query('#resetAllBtn'),
  clearSavesButton: query('#clearSavesBtn'),
  layoutOverlayButton: query('#layoutOverlayBtn'),
  moneyInput: query('#moneyInput'),
  blackjackWager: query('#blackjackWager'),
  blackjackDealButton: query('#blackjackDealBtn'),
  blackjackHitButton: query('#blackjackHitBtn'),
  blackjackStandButton: query('#blackjackStandBtn'),
  blackjackDoubleButton: query('#blackjackDoubleBtn'),
  blackjackSplitButton: query('#blackjackSplitBtn'),
  blackjackInsuranceButton: query('#blackjackInsuranceBtn'),
  blackjackNewButton: query('#blackjackNewBtn'),
  blackjackStatus: query('#blackjackStatus'),
  blackjackPlayerCards: query('#blackjackPlayerCards'),
  blackjackDealerCards: query('#blackjackDealerCards'),
  blackjackResult: query('#blackjackResult'),
  blackjackSeats: query('#blackjackSeats'),
  slotsTitle: query('#slotsTitle'),
  slotsWager: query('#slotsWager'),
  slotsWagerButton: query('#slotsWagerBtn'),
  slotsReadyButton: query('#slotsReadyBtn'),
  slotsSpinButton: query('#slotsSpinBtn'),
  bonusPickButtons: [...document.querySelectorAll<HTMLButtonElement>('[data-bonus-pick]')],
  slotsStatus: query('#slotsStatus'),
  slotReels: query('#slotReels'),
  slotsResult: query('#slotsResult'),
  slotsRoomPlayers: query('#slotsRoomPlayers'),
});

const query = <ElementType extends Element>(selector: string): ElementType => {
  const element = document.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
};
