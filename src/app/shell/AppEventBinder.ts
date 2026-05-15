import type { CasinoGameId } from '../../game/ids';
import type { AppElements } from '../dom/appElements/AppElements';
import type { AppEventCallbacks } from './AppEventCallbacks';

export class AppEventBinder {
  public constructor(
    private readonly elements: AppElements,
    private readonly callbacks: AppEventCallbacks,
  ) {}

  public bind(): void {
    this.elements.createProfileButton.addEventListener('click', () => this.callbacks.createProfile());
    this.elements.startSessionButton.addEventListener('click', () => this.callbacks.startSelectedProfiles());
    this.elements.roomRefreshButton.addEventListener('click', () => this.callbacks.refreshMultiplayerRooms());
    this.elements.hostRoomButton.addEventListener('click', () => this.callbacks.hostMultiplayerRoom());
    this.elements.leaveRoomButton.addEventListener('click', () => {
      this.closeHudOverflowMenu();
      this.callbacks.leaveMultiplayerRoom();
    });
    this.elements.backToLobbyButton.addEventListener('click', () => {
      this.closeHudOverflowMenu();
      this.callbacks.backToLobby();
    });
    this.elements.switchProfileButton.addEventListener('click', () => {
      this.closeHudOverflowMenu();
      this.callbacks.switchProfiles();
    });
    this.elements.houseAdvanceButton.addEventListener('click', () => this.callbacks.acceptHouseAdvance());
    this.elements.sessionLimitInput.addEventListener('change', () => this.callbacks.updateSessionLimit());
    this.bindHudOverflow();
    this.bindGameTabs();
    this.bindChips();
    this.bindBeatControls();
    this.bindBlackjackControls();
    this.bindSlotsControls();
  }

  private bindHudOverflow(): void {
    this.elements.hudOverflowMenu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.elements.hudOverflowMenu.open) {
        event.preventDefault();
        this.closeHudOverflowMenu(true);
      }
    });
    document.addEventListener('click', (event) => {
      if (!this.elements.hudOverflowMenu.open) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && !this.elements.hudOverflowMenu.contains(target)) {
        this.closeHudOverflowMenu();
      }
    });
  }

  private closeHudOverflowMenu(restoreFocus = false): void {
    this.elements.hudOverflowMenu.open = false;
    if (restoreFocus) {
      this.elements.hudOverflowMenu.querySelector('summary')?.focus();
    }
  }

  private bindGameTabs(): void {
    this.elements.gameTabs.forEach((button) => {
      button.addEventListener('click', () => {
        this.callbacks.openRoomLobby(button.dataset.game as CasinoGameId);
      });
    });
  }

  private bindChips(): void {
    this.elements.chipButtons.forEach((button) => {
      button.draggable = true;
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', String(button.dataset.chip ?? '0'));
      });
      button.addEventListener('click', () => this.callbacks.selectChip(button));
    });
    this.elements.tableHost.addEventListener('dragover', (event) => event.preventDefault());
    this.elements.tableHost.addEventListener('drop', (event) => this.callbacks.dropChipOnTable(event));
  }

  private bindBeatControls(): void {
    this.elements.dealButton.addEventListener('click', () => this.callbacks.runBeatAction('start-round'));
    this.elements.nextButton.addEventListener('click', () => this.callbacks.runBeatAction('next-round'));
    this.elements.hitButton.addEventListener('click', () => this.callbacks.runBeatAction({ type: 'player-action', action: 'hit' }));
    this.elements.stickButton.addEventListener('click', () => this.callbacks.runBeatAction({ type: 'player-action', action: 'stick' }));
    this.elements.rebetButton.addEventListener('click', () => this.callbacks.runBeatAction('rebet'));
    this.elements.clearButton.addEventListener('click', () => this.callbacks.runBeatAction('clear-bets'));
    this.elements.addMoneyButton.addEventListener('click', () => this.callbacks.addMoney());
    this.elements.subtractMoneyButton.addEventListener('click', () => this.callbacks.subtractMoney());
    this.elements.resetMoneyButton.addEventListener('click', () => this.callbacks.resetMoney());
    this.elements.authorizeAdminButton.addEventListener('click', () => this.callbacks.authorizeAdmin());
    this.elements.resetAllButton.addEventListener('click', () => this.callbacks.resetAllProfiles());
    this.elements.clearSavesButton.addEventListener('click', () => this.callbacks.clearSaves());
    this.elements.layoutOverlayButton.addEventListener('click', () => this.callbacks.toggleLayoutOverlay());
  }

  private bindBlackjackControls(): void {
    this.elements.blackjackDealButton.addEventListener('click', () => this.callbacks.dealBlackjack());
    this.elements.blackjackHitButton.addEventListener('click', () => this.callbacks.hitBlackjack());
    this.elements.blackjackStandButton.addEventListener('click', () => this.callbacks.standBlackjack());
    this.elements.blackjackDoubleButton.addEventListener('click', () => this.callbacks.doubleBlackjack());
    this.elements.blackjackSplitButton.addEventListener('click', () => this.callbacks.splitBlackjack());
    this.elements.blackjackInsuranceButton.addEventListener('click', () => this.callbacks.insureBlackjack());
    this.elements.blackjackNewButton.addEventListener('click', () => this.callbacks.newBlackjackHand());
  }

  private bindSlotsControls(): void {
    this.elements.slotsWagerButton.addEventListener('click', () => this.callbacks.setSlotsWager());
    this.elements.slotsReadyButton.addEventListener('click', () => this.callbacks.readySlots());
    this.elements.slotsSpinButton.addEventListener('click', () => this.callbacks.spinSlots());
    this.elements.bonusPickButtons.forEach((button) => {
      button.addEventListener('click', () => this.callbacks.pickSlotsBonus());
    });
  }
}
