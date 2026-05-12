import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryServerDataStore } from '../../../src/state/serverDataStore/createMemoryServerDataStore';
import { SqliteServerDataStore } from '../../../src/state/serverDataStore/SqliteServerDataStore';
import { createSessionState } from '../../../src/state/session/createSessionState';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('server data store', () => {
  it('keeps profile and session data server-owned in memory', () => {
    const store = createMemoryServerDataStore();
    const created = store.createProfile('Memory QA');
    const profile = created.profileState.profiles[0];

    store.saveSession(
      createSessionState([profile.id], {
        selectedPlayerIndex: 0,
        activeGame: 'blackjack',
        showingGameLobby: false,
        wagerLimit: 200,
        wagered: 50,
        gameSnapshots: {},
      }),
    );

    const snapshot = store.snapshot();
    expect(snapshot.database).toBe('memory');
    expect(snapshot.profileState.profiles[0]).toMatchObject({ name: 'Memory QA', bankroll: 1000 });
    expect(snapshot.session).toMatchObject({ activeGame: 'blackjack', wagerLimit: 200, wagered: 50 });
  });

  it('persists profile, ledger, and session data in SQLite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'casino-store-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'casino.sqlite');
    const store = new SqliteServerDataStore(dbPath);
    const created = store.createProfile('SQLite QA');
    const profile = created.profileState.profiles[0];

    store.recordTransaction(profile.id, {
      gameId: 'admin',
      type: 'admin_adjustment',
      amount: 125,
      description: 'SQLite persistence check',
      metadata: {},
    });
    store.saveSession(
      createSessionState([profile.id], {
        selectedPlayerIndex: 0,
        activeGame: 'beat-the-house',
        showingGameLobby: true,
        wagerLimit: 0,
        wagered: 0,
        gameSnapshots: {},
      }),
    );

    const reloaded = new SqliteServerDataStore(dbPath).snapshot();
    expect(reloaded.database).toBe('sqlite');
    expect(reloaded.profileState.profiles[0]).toMatchObject({
      name: 'SQLite QA',
      bankroll: 1125,
      transactions: [expect.objectContaining({ type: 'admin_adjustment', amount: 125, description: 'SQLite persistence check' })],
    });
    expect(reloaded.session).toMatchObject({ activeGame: 'beat-the-house', profileIds: [profile.id] });
  });
});
