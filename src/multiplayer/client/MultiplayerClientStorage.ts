import type { ProfileToken } from '../../schemas/casinoSchemas/ProfileToken';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import { parseJsonText } from '../../schemas/casinoSchemas/parseJsonText';
import { profileTokenStorageSchema } from '../../schemas/casinoSchemas/profileTokenStorageSchema';
import type { MultiplayerClientEvents } from './MultiplayerClientEvents';
import { profileTokensStorageKey } from './profileTokensStorageKey';

export abstract class MultiplayerClientStorage {
  protected readonly ownedProfileIds = new Set<ProfileId>();
  protected adminAuthorized = false;

  public constructor(protected readonly events: MultiplayerClientEvents) {}

  public ownsProfile(profileId: ProfileId): boolean {
    return this.ownedProfileIds.has(profileId);
  }

  protected storeProfileToken(profileId: ProfileId, profileToken: ProfileToken): void {
    const profileTokens = MultiplayerClientStorage.readProfileTokens();
    profileTokens.set(profileId, profileToken);
    MultiplayerClientStorage.writeProfileTokens(profileTokens);
  }

  protected forgetProfileToken(profileId: ProfileId): void {
    const profileTokens = MultiplayerClientStorage.readProfileTokens();
    profileTokens.delete(profileId);
    MultiplayerClientStorage.writeProfileTokens(profileTokens);
    this.ownedProfileIds.delete(profileId);
  }

  protected clearProfileTokens(): void {
    MultiplayerClientStorage.removeStorageValue(profileTokensStorageKey);
    this.ownedProfileIds.clear();
    this.events.onProfileAccess([]);
  }

  protected pruneStoredProfileTokens(ownedProfileIds: readonly ProfileId[]): void {
    const owned = new Set(ownedProfileIds);
    const profileTokens = MultiplayerClientStorage.readProfileTokens();
    for (const profileId of profileTokens.keys()) {
      if (!owned.has(profileId)) {
        profileTokens.delete(profileId);
      }
    }
    MultiplayerClientStorage.writeProfileTokens(profileTokens);
  }

  protected static readProfileTokens(): Map<ProfileId, ProfileToken> {
    const value = MultiplayerClientStorage.readStorageValue(profileTokensStorageKey);
    if (!value) {
      return new Map();
    }
    try {
      const parsed = profileTokenStorageSchema.parse(parseJsonText(value));
      return new Map(parsed.map((entry) => [entry.profileId, entry.profileToken]));
    } catch {
      return new Map();
    }
  }

  protected static writeProfileTokens(profileTokens: ReadonlyMap<ProfileId, ProfileToken>): void {
    MultiplayerClientStorage.writeStorageValue(profileTokensStorageKey, JSON.stringify(MultiplayerClientStorage.profileTokenEntries(profileTokens)));
  }

  protected static profileTokenEntries(
    profileTokens: ReadonlyMap<ProfileId, ProfileToken>,
  ): { readonly profileId: ProfileId; readonly profileToken: ProfileToken }[] {
    return [...profileTokens.entries()].map(([profileId, profileToken]) => ({ profileId, profileToken }));
  }

  protected static readStorageValue(key: string): string {
    try {
      return globalThis.localStorage?.getItem(key) ?? '';
    } catch {
      return '';
    }
  }

  protected static writeStorageValue(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Browser storage can be unavailable in private contexts; the server remains authoritative.
    }
  }

  protected static removeStorageValue(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Browser storage can be unavailable in private contexts; the server remains authoritative.
    }
  }
}
