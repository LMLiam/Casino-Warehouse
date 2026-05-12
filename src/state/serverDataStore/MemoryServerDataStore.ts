import type { BankrollTransaction } from '../profiles/BankrollTransaction';
import type { CasinoProfile } from '../profiles/CasinoProfile';
import type { CasinoSaveState } from '../profiles/CasinoSaveState';
import { createProfile as createProfileRecord } from '../profiles/createProfile';
import { deleteProfile } from '../profiles/deleteProfile';
import { emptySaveState } from '../profiles/emptySaveState';
import { emptyStats } from '../profiles/emptyStats';
import { parseProfileStoreJson } from '../profiles/parseProfileStoreJson';
import { recordTransaction } from '../profiles/recordTransaction';
import { renameProfile } from '../profiles/renameProfile';
import { replaceProfile } from '../profiles/replaceProfile';
import type { CasinoSessionState } from '../session/CasinoSessionState';
import { createSessionState } from '../session/createSessionState';
import { parseSessionState } from '../session/parseSessionState';
import type { ServerDatabaseChoice } from './ServerDatabaseChoice';
import type { ServerDataSnapshot } from './ServerDataSnapshot';
import type { ServerDataStore } from './ServerDataStore';

export class MemoryServerDataStore implements ServerDataStore {
  public readonly database: ServerDatabaseChoice = 'memory';
  private profileState: CasinoSaveState = emptySaveState();
  private session: CasinoSessionState | undefined;

  public snapshot(): ServerDataSnapshot {
    return { database: this.database, profileState: this.profileState, session: this.session };
  }

  public createProfile(name: string, bankroll = 1000): ServerDataSnapshot {
    this.profileState = createProfileRecord(this.profileState, name, bankroll);
    return this.snapshot();
  }

  public renameProfile(profileId: string, name: string): ServerDataSnapshot {
    this.profileState = renameProfile(this.profileState, profileId, name);
    return this.snapshot();
  }

  public deleteProfile(profileId: string): ServerDataSnapshot {
    this.profileState = deleteProfile(this.profileState, profileId);
    this.session = this.session
      ? createSessionState(
          this.session.profileIds.filter((id) => id !== profileId),
          this.session,
        )
      : undefined;
    return this.snapshot();
  }

  protected loadProfilesFromJson(profileStoreJson: string): ServerDataSnapshot {
    this.profileState = parseProfileStoreJson(profileStoreJson);
    this.session = undefined;
    return this.snapshot();
  }

  public saveSession(session: CasinoSessionState): ServerDataSnapshot {
    this.session = parseSessionState(session);
    return this.snapshot();
  }

  public clear(): ServerDataSnapshot {
    this.profileState = emptySaveState();
    this.session = undefined;
    return this.snapshot();
  }

  public ensureProfile(profileId: string, profileName: string, bankroll: number): CasinoProfile {
    const existing = this.findProfile(profileId);
    if (existing) {
      return existing;
    }
    const at = new Date().toISOString();
    const profile: CasinoProfile = {
      id: profileId,
      name: profileName.trim().replace(/\s+/g, ' ').slice(0, 32) || 'Player',
      color: '#7dd3fc',
      bankroll: safeMoney(bankroll),
      stats: emptyStats(),
      transactions: [],
      createdAt: at,
      updatedAt: at,
    };
    this.profileState = { ...this.profileState, profiles: [...this.profileState.profiles, profile] };
    return profile;
  }

  public setProfileBankroll(profileId: string, bankroll: number): CasinoProfile | undefined {
    const profile = this.findProfile(profileId);
    if (!profile) {
      return undefined;
    }
    const updated = { ...profile, bankroll: safeMoney(bankroll), updatedAt: new Date().toISOString() };
    this.profileState = replaceProfile(this.profileState, updated);
    return updated;
  }

  public recordTransaction(
    profileId: string,
    transaction: Omit<BankrollTransaction, 'id' | 'profileId' | 'at' | 'balanceBefore' | 'balanceAfter'>,
  ): CasinoProfile | undefined {
    const profile = this.findProfile(profileId);
    if (!profile) {
      return undefined;
    }
    const updated = recordTransaction(profile, transaction);
    this.profileState = replaceProfile(this.profileState, updated);
    return updated;
  }

  private findProfile(profileId: string): CasinoProfile | undefined {
    return this.profileState.profiles.find((profile) => profile.id === profileId);
  }
}

const safeMoney = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
