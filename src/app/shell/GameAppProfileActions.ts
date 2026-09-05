import type { RoomSettlement } from '../../multiplayer/protocol/RoomSettlement';
import type { RoomSnapshot } from '../../multiplayer/protocol/RoomSnapshot';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { SessionId } from '../../schemas/casinoSchemas/SessionId';
import { profileIdSchema } from '../../schemas/casinoSchemas/profileIdSchema';
import { readCreditInput } from '../input/appInputs/readCreditInput';
import { readPositiveCreditInput } from '../input/appInputs/readPositiveCreditInput';
import { createPlayerFromProfile } from '../state/casinoPlayer/createPlayerFromProfile';
import type { PixiTableSettlementMetadata } from '../../ui/PixiTable/PixiTableSettlementMetadata';
import { BeatSettlementMetadataCache } from './BeatSettlementMetadataCache';
import { GameAppRoomActions } from './GameAppRoomActions';

export abstract class GameAppProfileActions extends GameAppRoomActions {
  protected abstract readonly beatSettlementMetadata: BeatSettlementMetadataCache;

  protected beatSettlementMetadataFor(room: RoomSnapshot | undefined, profileId: ProfileId | undefined): readonly PixiTableSettlementMetadata[] {
    return this.beatSettlementMetadata.get(room, profileId);
  }

  protected applyRoomSettlements(settlements: readonly RoomSettlement[], roomId: RoomId, sessionId: SessionId): void {
    const profileId = this.currentPlayer?.profileId;
    if (!profileId) {
      return;
    }
    const profileSettlements = settlements.filter((settlement) => settlement.profileId === profileId);
    if (this.activeRoomForGame()?.gameId === 'beat-the-house' && profileSettlements.length > 0) {
      this.beatSettlementMetadata.set(roomId, sessionId, profileId, profileSettlements);
    }
    profileSettlements.forEach((settlement) => {
      if (settlement.wagered > 0) {
        this.recordSessionWager(settlement.wagered);
      }
    });
    this.renderCasino();
  }

  protected createProfileFromInput(): void {
    if (!this.canUseServer()) {
      return;
    }
    this.multiplayer.createProfile(this.elements.profileNameInput.value);
    this.elements.profileNameInput.value = '';
  }

  protected startSelectedProfiles(): void {
    if (!this.canUseServer()) {
      return;
    }

    const selectedId = profileIdSchema.safeParse(this.elements.profileList.querySelector<HTMLInputElement>('[data-profile-select]:checked')?.value ?? '');
    const ownedIds = this.profileState.profiles.filter((profile) => this.ownedProfileIds.has(profile.id)).map((profile) => profile.id);
    const profileId = selectedId.success && this.ownedProfileIds.has(selectedId.data) ? selectedId.data : ownedIds[0];
    const profile = profileId ? this.profileState.profiles.find((candidate) => candidate.id === profileId) : undefined;
    if (!profile) {
      this.lastSaveError = 'Create or unlock a profile in this browser before starting a session.';
      this.renderProfileSetup();
      return;
    }

    this.player = createPlayerFromProfile(profile);
    this.activeGame = 'beat-the-house';
    this.showingGameLobby = true;
    this.sessionWagered = 0;
    this.sessionWagerLimit = readCreditInput(this.elements.sessionLimitInput);
    this.walletView.resetPreviousBankroll();
    this.elements.setup.classList.add('hidden');
    this.elements.shell.classList.remove('hidden');
    this.table.resize();
    this.renderPlayerProfile();
    this.renderGameLobby();
    this.saveSession();
    this.renderCasino();
    this.maybeAutoJoinInvite();
  }

  protected adjustCurrentBankroll(action: 'add' | 'subtract' | 'reset'): void {
    const profile = this.currentProfile();
    if (!profile || !this.canUseServer()) {
      return;
    }
    if (action === 'reset' && !window.confirm('Reset this profile bankroll to £1,000?')) {
      return;
    }
    this.multiplayer.adjustBankroll(profile.id, action, readPositiveCreditInput(this.elements.moneyInput));
  }

  protected acceptHouseAdvance(): void {
    const profile = this.currentProfile();
    if (!profile || !this.canUseServer()) {
      return;
    }
    this.elements.houseAdvanceButton.disabled = true;
    this.multiplayer.acceptHouseAdvance(profile.id);
  }

  protected authorizeAdmin(): void {
    this.multiplayer.authorizeAdmin(this.elements.adminTokenInput.value);
  }

  protected resetAllBankrolls(): void {
    if (!this.canUseServer() || !window.confirm('Reset every server profile bankroll to £1,000?')) {
      return;
    }
    this.multiplayer.resetAllBankrolls();
  }

  protected clearServerData(): void {
    if (!this.canUseServer() || !window.confirm('Clear all saved profiles and session data?')) {
      return;
    }
    this.player = undefined;
    this.walletView.clear();
    this.elements.beatSettlementAnnouncement.textContent = '';
    this.profileState = { profiles: [] };
    this.pendingRoomRestore = undefined;
    this.clearClientSession();
    this.profileSetupView.clearSelection();
    this.multiplayer.clearServerData();
    this.elements.shell.classList.add('hidden');
    this.elements.setup.classList.remove('hidden');
    this.renderProfileSetup();
  }

  protected applyProfileAccess(ownedProfileIds: readonly ProfileId[]): void {
    this.profileAccessReceived = true;
    this.ownedProfileIds.clear();
    ownedProfileIds.forEach((profileId) => this.ownedProfileIds.add(profileId));
    if (this.player && !this.ownedProfileIds.has(this.player.profileId)) {
      this.player = undefined;
      this.walletView.clear();
      this.elements.beatSettlementAnnouncement.textContent = '';
    }
    if (!this.player) {
      const clientSession = this.loadClientSession();
      if (clientSession && this.ownedProfileIds.has(clientSession.profileId)) {
        this.restoreSavedSession(clientSession);
      }
    }
    this.renderProfileSetup();
    if (this.player) {
      this.elements.setup.classList.add('hidden');
      this.elements.shell.classList.remove('hidden');
      this.renderPlayerProfile();
      this.renderGameLobby();
      this.renderCasino();
    }
  }

  protected applyAdminAccess(authorized: boolean): void {
    if (authorized) {
      this.elements.adminTokenInput.value = '';
      this.elements.roomStatus.textContent = 'Admin controls unlocked.';
    } else {
      this.elements.roomStatus.textContent = 'Admin token was not accepted.';
    }
    this.renderAdminControls();
  }

  protected renderAdminControls(): void {
    const adminButtons = [
      this.elements.addMoneyButton,
      this.elements.subtractMoneyButton,
      this.elements.resetMoneyButton,
      this.elements.resetAllButton,
      this.elements.clearSavesButton,
    ];
    adminButtons.forEach((button) => {
      button.disabled = !this.multiplayer.hasAdminAccess;
    });
    this.elements.authorizeAdminButton.textContent = this.multiplayer.hasAdminAccess ? 'Admin Unlocked' : 'Unlock Admin';
    this.elements.authorizeAdminButton.disabled = this.multiplayer.hasAdminAccess;
    this.elements.adminTokenInput.disabled = this.multiplayer.hasAdminAccess;
  }

  protected canWager(amount: number): boolean {
    return amount > 0 && (this.sessionWagerLimit <= 0 || this.sessionWagered + amount <= this.sessionWagerLimit);
  }

  protected recordSessionWager(amount: number): void {
    this.sessionWagered += Math.max(0, Math.floor(amount));
    this.saveSession();
    this.renderSessionLimit();
  }
}
