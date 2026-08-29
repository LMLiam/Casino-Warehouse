import type { CasinoProfile } from '../../state/profiles/CasinoProfile';
import type { CasinoSaveState } from '../../state/profiles/CasinoSaveState';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import { profileIdSchema } from '../../schemas/casinoSchemas/profileIdSchema';
import { escapeHtml } from '../../shared/html';
import type { AppElements } from '../dom/appElements/AppElements';
import { money } from '../format/appMoney';

export class ProfileSetupView {
  private pendingDeleteProfileId = '';
  private pendingRenameProfileId = '';
  private selectedProfileId = '';

  public constructor(private readonly elements: AppElements) {}

  public clearSelection(): void {
    this.selectedProfileId = '';
    this.pendingDeleteProfileId = '';
    this.pendingRenameProfileId = '';
  }

  public render(
    profileState: CasinoSaveState,
    lastSaveError: string,
    ownedProfileIds: ReadonlySet<ProfileId>,
    onRename: (profileId: ProfileId, nextName: string) => void,
    onDelete: (profileId: ProfileId) => void,
  ): void {
    this.rememberCheckedProfiles();
    this.pruneDeletedSelections(profileState);
    this.pruneUnownedSelection(ownedProfileIds);
    this.selectFirstOwnedProfile(profileState, ownedProfileIds);
    this.elements.profileList.innerHTML =
      profileState.profiles.length === 0
        ? '<p class="empty-state">Create a profile to save bankroll, stats, and history.</p>'
        : profileState.profiles.map((profile) => this.renderRow(profile, ownedProfileIds.has(profile.id))).join('');

    this.elements.profileList.querySelectorAll<HTMLInputElement>('[data-profile-select]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) {
          this.selectedProfileId = input.value;
        }
      });
    });

    this.elements.profileList.querySelectorAll<HTMLButtonElement>('[data-profile-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const parsedProfileId = profileIdSchema.safeParse(button.dataset.profileId ?? '');
        if (!parsedProfileId.success) {
          return;
        }
        const profileId = parsedProfileId.data;
        if (button.dataset.profileAction === 'rename') {
          this.pendingRenameProfileId = profileId;
          this.pendingDeleteProfileId = '';
          this.render(profileState, lastSaveError, ownedProfileIds, onRename, onDelete);
        }
        if (button.dataset.profileAction === 'save-rename') {
          const input = this.elements.profileList.querySelector<HTMLInputElement>(`[data-profile-rename-input="${CSS.escape(profileId)}"]`);
          const nextName = input?.value.trim() ?? '';
          if (nextName) {
            this.pendingRenameProfileId = '';
            onRename(profileId, nextName);
          }
        }
        if (button.dataset.profileAction === 'delete') {
          this.pendingDeleteProfileId = profileId;
          this.pendingRenameProfileId = '';
          this.render(profileState, lastSaveError, ownedProfileIds, onRename, onDelete);
        }
        if (button.dataset.profileAction === 'confirm-delete') {
          this.pendingDeleteProfileId = '';
          onDelete(profileId);
        }
        if (button.dataset.profileAction === 'cancel') {
          this.pendingDeleteProfileId = '';
          this.pendingRenameProfileId = '';
          this.render(profileState, lastSaveError, ownedProfileIds, onRename, onDelete);
        }
      });
    });

    this.elements.profileList.querySelectorAll<HTMLInputElement>('[data-profile-rename-input]').forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          this.pendingRenameProfileId = '';
          this.render(profileState, lastSaveError, ownedProfileIds, onRename, onDelete);
        }
        if (event.key === 'Enter') {
          const nextName = input.value.trim();
          if (nextName) {
            this.pendingRenameProfileId = '';
            const parsedProfileId = profileIdSchema.safeParse(input.dataset.profileRenameInput ?? '');
            if (parsedProfileId.success) {
              onRename(parsedProfileId.data, nextName);
            }
          }
        }
      });
    });
    this.elements.profileList.querySelector<HTMLInputElement>('[data-profile-rename-input]')?.focus();
    this.elements.saveStatus.textContent = lastSaveError;
    this.elements.startSessionButton.disabled = profileState.profiles.every((profile) => !ownedProfileIds.has(profile.id));
  }

  private renderRow(profile: CasinoProfile, owned: boolean): string {
    const isRenaming = this.pendingRenameProfileId === profile.id;
    const isDeleting = this.pendingDeleteProfileId === profile.id;
    const selected = this.selectedProfileId === profile.id ? 'checked' : '';
    const disabled = owned ? '' : 'disabled';
    const ownershipNote = owned ? '' : '<em>Profile is on this server, but this browser does not own it.</em>';
    const actionPrompt = isRenaming
      ? `
        <div class="profile-action-prompt rename" role="group" aria-label="Rename ${escapeHtml(profile.name)}">
          <input data-profile-rename-input="${escapeHtml(profile.id)}" aria-label="New profile name" type="text" maxlength="32" value="${escapeHtml(profile.name)}" />
          <button type="button" data-profile-action="save-rename" data-profile-id="${escapeHtml(profile.id)}">Save</button>
          <button type="button" data-profile-action="cancel" data-profile-id="${escapeHtml(profile.id)}">Cancel</button>
        </div>
      `
      : isDeleting
        ? `
        <div class="profile-action-prompt danger" role="alert">
          <span>Delete ${escapeHtml(profile.name)}?</span>
          <button type="button" data-profile-action="confirm-delete" data-profile-id="${escapeHtml(profile.id)}">Delete Profile</button>
          <button type="button" data-profile-action="cancel" data-profile-id="${escapeHtml(profile.id)}">Cancel</button>
        </div>
      `
        : '';
    return `
      <article class="profile-row">
        <label>
          <input type="radio" name="profile-session" data-profile-select value="${escapeHtml(profile.id)}" ${selected} ${disabled} />
          <span>
            <b>${escapeHtml(profile.name)}</b>
            <small>${money(profile.bankroll)} • ${profile.stats.gamesPlayed} games • biggest ${money(profile.stats.biggestWin)}</small>
            ${ownershipNote}
          </span>
        </label>
        <div>
          <button type="button" data-profile-action="rename" data-profile-id="${escapeHtml(profile.id)}" ${disabled}>Rename</button>
          <button type="button" data-profile-action="delete" data-profile-id="${escapeHtml(profile.id)}" ${disabled}>Delete</button>
        </div>
        ${actionPrompt}
      </article>
    `;
  }

  private rememberCheckedProfiles(): void {
    this.selectedProfileId = this.elements.profileList.querySelector<HTMLInputElement>('[data-profile-select]:checked')?.value ?? this.selectedProfileId;
  }

  private pruneDeletedSelections(profileState: CasinoSaveState): void {
    const currentProfileIds = new Set(profileState.profiles.map((profile) => profile.id));
    const selectedProfileId = profileIdSchema.safeParse(this.selectedProfileId);
    if (selectedProfileId.success && !currentProfileIds.has(selectedProfileId.data)) {
      this.selectedProfileId = '';
    }
  }

  private pruneUnownedSelection(ownedProfileIds: ReadonlySet<ProfileId>): void {
    const selectedProfileId = profileIdSchema.safeParse(this.selectedProfileId);
    if (selectedProfileId.success && !ownedProfileIds.has(selectedProfileId.data)) {
      this.selectedProfileId = '';
    }
  }

  private selectFirstOwnedProfile(profileState: CasinoSaveState, ownedProfileIds: ReadonlySet<ProfileId>): void {
    if (this.selectedProfileId) {
      return;
    }
    this.selectedProfileId = profileState.profiles.find((profile) => ownedProfileIds.has(profile.id))?.id ?? '';
  }
}
