import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/game/cards/Card';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { BeatTheHouseSaveState } from '../../../src/game/engine/BeatTheHouseSaveState';
import { createBeatTheHouseShoe } from '../../../src/game/beatTheHouse/shoe/createBeatTheHouseShoe';
import type { Phase } from '../../../src/game/types/Phase';
import type { RoundSummary } from '../../../src/game/types/RoundSummary';
import type { CasinoSessionState } from '../../../src/state/session/CasinoSessionState';
import type { BeatTheHouseSaveStateV3 } from '../../../src/state/session/BeatTheHouseSaveStateV3';
import type { LegacyBeatMigrationPort } from '../../../src/state/session/LegacyBeatMigrationPort';
import { createSessionState } from '../../../src/state/session/createSessionState';
import { currentSessionStateVersion } from '../../../src/state/session/currentSessionStateVersion';
import { migrateLegacyBeatTheHouseSession } from '../../../src/state/session/migrateLegacyBeatTheHouseSession';
import { parseSessionState } from '../../../src/state/session/parseSessionState';
import { parseSessionStateV3 } from '../../../src/state/session/parseSessionStateV3';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

const makeLegacySaveState = (phase: Phase, withTableCredits: boolean): BeatTheHouseSaveState => {
  const saved = new BeatTheHouseGame({ initialBankroll: 999, deck: [card('K', 'spades')] }).saveState();
  const bets = withTableCredits ? { ...saved.bets, left: { ...saved.bets.left, main: 20 } } : saved.bets;
  const dealerTips = withTableCredits ? { ...saved.dealerTips, left: 10 } : saved.dealerTips;
  const summary: RoundSummary = { handId: 'left', mainResult: 'win', stake: 20, returned: 40, profit: 20, sideWins: [] };

  return {
    ...saved,
    phase,
    bets,
    dealerTips,
    lastBets: saved.bets,
    summaries: phase === 'roundOver' ? [summary] : [],
  };
};

const makeLegacySession = (phase: Phase, withTableCredits: boolean): CasinoSessionState =>
  createSessionState(
    'profile-a',
    {
      activeGame: 'beat-the-house',
      showingGameLobby: false,
      wagerLimit: 250,
      wagered: 75,
      room: { roomId: 'ROOM42', gameId: 'beat-the-house', role: 'player', seatId: 'centre' },
      gameSnapshot: {
        beatTheHouse: makeLegacySaveState(phase, withTableCredits),
        blackjack: {
          phase: 'player',
          wager: 25,
          playerCards: [],
          dealerCards: [],
          dealerHoleHidden: true,
          insuranceWager: 0,
          splitHands: [],
          returned: 0,
          status: 'Saved Blackjack table.',
        },
        slots: {},
      },
    },
    new Date('2026-08-28T12:00:00Z'),
  );

const makeFreshSaveState = (): BeatTheHouseSaveStateV3 => {
  const saved = new BeatTheHouseGame({ initialBankroll: 999, deck: [card('K', 'spades')] }).saveState();
  const { deck: _legacyDeck, ...withoutDeck } = saved;
  return {
    ...withoutDeck,
    shoe: createBeatTheHouseShoe(() => 0).saveState(),
    lastBets: saved.bets,
  };
};

const makeCleanFreshSaveState = (): BeatTheHouseSaveStateV3 => {
  const { lastBets: _lastBets, ...withoutLastBets } = makeFreshSaveState();
  return withoutLastBets;
};

const makeV3Value = (beatTheHouse: BeatTheHouseSaveStateV3 | (BeatTheHouseSaveStateV3 & { readonly deck: readonly Card[] })) => ({
  version: 3 as const,
  profileId: 'profile-a',
  activeGame: 'beat-the-house' as const,
  showingGameLobby: false,
  wagerLimit: 250,
  wagered: 75,
  gameSnapshot: { beatTheHouse },
  updatedAt: '2026-08-28T12:00:00Z',
});

const migrationCases: readonly { phase: Phase; withTableCredits: boolean; expectedRefund: number }[] = [
  { phase: 'betting', withTableCredits: false, expectedRefund: 0 },
  { phase: 'betting', withTableCredits: true, expectedRefund: 30 },
  { phase: 'dealing', withTableCredits: true, expectedRefund: 30 },
  { phase: 'playing', withTableCredits: true, expectedRefund: 30 },
  { phase: 'dealer', withTableCredits: true, expectedRefund: 30 },
  { phase: 'roundOver', withTableCredits: true, expectedRefund: 0 },
];

describe('session v3 migration preparation', () => {
  it('parses a private six-deck save and preserves the exact next card', () => {
    const saveState = makeCleanFreshSaveState();
    const session = parseSessionStateV3(makeV3Value(saveState));

    expect(session.version).toBe(3);
    expect(session.gameSnapshot?.beatTheHouse?.shoe.remainingCards.at(-1)).toEqual(saveState.shoe.remainingCards.at(-1));
    expect(session.gameSnapshot?.beatTheHouse?.shoe.cutThresholdCardsDealt).toBe(219);
  });

  it('rejects a v3 save with an old deck field', () => {
    const saveState = makeCleanFreshSaveState();

    expect(() =>
      parseSessionStateV3(
        makeV3Value({
          ...saveState,
          deck: [],
        }),
      ),
    ).toThrow('Beat the House session v3 save state is not valid.');
  });

  it('rejects a production shoe threshold below the approved range', () => {
    const saveState = makeCleanFreshSaveState();

    expect(() =>
      parseSessionStateV3(
        makeV3Value({
          ...saveState,
          shoe: { ...saveState.shoe, cutThresholdCardsDealt: 218 },
        }),
      ),
    ).toThrow('below the production range');
  });

  it('rejects duplicate physical cards while allowing a dealt card to be absent', () => {
    const saveState = makeCleanFreshSaveState();
    const duplicateCards = Array.from({ length: 7 }, () => card('A', 'spades'));

    expect(() =>
      parseSessionStateV3(
        makeV3Value({
          ...saveState,
          shoe: { ...saveState.shoe, remainingCards: duplicateCards, shufflePending: true },
        }),
      ),
    ).toThrow('too many copies');

    const dealtCardSaveState = {
      ...saveState,
      shoe: { ...saveState.shoe, remainingCards: saveState.shoe.remainingCards.slice(0, -1) },
    };
    const parsed = parseSessionStateV3(makeV3Value(dealtCardSaveState));

    expect(parsed.gameSnapshot?.beatTheHouse?.shoe.remainingCards).toHaveLength(311);
  });

  it.each(migrationCases)('applies the approved $phase migration policy', ({ phase, withTableCredits, expectedRefund }) => {
    const port: LegacyBeatMigrationPort = {
      migrateLegacyBeatTheHouseSession: (evidence) => ({
        status: 'migrated',
        refundedWholeCredits: evidence.phase === 'roundOver' ? 0 : evidence.snapshotTableCredits,
      }),
    };
    const result = migrateLegacyBeatTheHouseSession({
      value: makeLegacySession(phase, withTableCredits),
      profileBankroll: 467,
      freshBeatSaveState: makeFreshSaveState(),
      port,
    });

    expect(result.migration.status).toBe('migrated');
    expect(result.migration.refundedWholeCredits).toBe(expectedRefund);
    expect(result.session?.version).toBe(3);
    expect(result.session?.activeGame).toBe('beat-the-house');
    expect(result.session?.showingGameLobby).toBe(false);
    expect(result.session?.wagerLimit).toBe(250);
    expect(result.session?.wagered).toBe(75);
    expect(result.session?.room).toEqual({ roomId: 'ROOM42', gameId: 'beat-the-house', role: 'player', seatId: 'centre' });
    expect(result.session?.gameSnapshot?.blackjack?.status).toBe('Saved Blackjack table.');
    expect(result.session?.gameSnapshot?.beatTheHouse?.phase).toBe('betting');
    expect(result.session?.gameSnapshot?.beatTheHouse?.bankroll).toBe(467);
    expect(result.session?.gameSnapshot?.beatTheHouse?.bets.left.main).toBe(0);
    expect(result.session?.gameSnapshot?.beatTheHouse?.dealerTips.left).toBe(0);
    expect(result.session?.gameSnapshot?.beatTheHouse?.summaries).toEqual([]);
    expect(result.session?.gameSnapshot?.beatTheHouse?.lastBets).toBeUndefined();
  });

  it('blocks an active migration when the profile has no authoritative reservation', () => {
    const port: LegacyBeatMigrationPort = {
      migrateLegacyBeatTheHouseSession: () => ({ status: 'blocked', refundedWholeCredits: 0, reason: 'No reservation.' }),
    };
    const result = migrateLegacyBeatTheHouseSession({
      value: makeLegacySession('playing', true),
      profileBankroll: 467,
      freshBeatSaveState: makeFreshSaveState(),
      port,
    });

    expect(result.session).toBeUndefined();
    expect(result.migration).toEqual({ status: 'blocked', refundedWholeCredits: 0, reason: 'No reservation.' });
  });

  it('blocks a completed migration without an authoritative receipt', () => {
    const port: LegacyBeatMigrationPort = {
      migrateLegacyBeatTheHouseSession: () => ({ status: 'blocked', refundedWholeCredits: 0, reason: 'No receipt.' }),
    };
    const result = migrateLegacyBeatTheHouseSession({
      value: makeLegacySession('roundOver', true),
      profileBankroll: 467,
      freshBeatSaveState: makeFreshSaveState(),
      port,
    });

    expect(result.session).toBeUndefined();
    expect(result.migration.reason).toBe('No receipt.');
  });

  it('does not refund snapshot credits when the port provides no authoritative refund', () => {
    const port: LegacyBeatMigrationPort = {
      migrateLegacyBeatTheHouseSession: () => ({ status: 'migrated', refundedWholeCredits: 0 }),
    };
    const result = migrateLegacyBeatTheHouseSession({
      value: makeLegacySession('playing', true),
      profileBankroll: 467,
      freshBeatSaveState: makeFreshSaveState(),
      port,
    });

    expect(result.session).toBeUndefined();
    expect(result.migration.status).toBe('blocked');
    expect(result.migration.refundedWholeCredits).toBe(0);
  });

  it('accepts an already-completed migration without applying a second refund', () => {
    const port: LegacyBeatMigrationPort = {
      migrateLegacyBeatTheHouseSession: () => ({ status: 'already-migrated', refundedWholeCredits: 0 }),
    };
    const result = migrateLegacyBeatTheHouseSession({
      value: makeLegacySession('playing', true),
      profileBankroll: 467,
      freshBeatSaveState: makeFreshSaveState(),
      port,
    });

    expect(result.session?.version).toBe(3);
    expect(result.migration.status).toBe('already-migrated');
    expect(result.migration.refundedWholeCredits).toBe(0);
  });

  it('keeps the current writer and dispatcher on session version 2', () => {
    expect(currentSessionStateVersion).toBe(2);
    expect(() => parseSessionState(makeV3Value(makeCleanFreshSaveState()))).toThrow('version 3 is not supported');
  });

  it('keeps the private shoe out of public game snapshots', () => {
    const publicSnapshot = new BeatTheHouseGame({ deck: [card('K', 'spades')] }).snapshot();

    expect(publicSnapshot).not.toHaveProperty('deck');
    expect(publicSnapshot).not.toHaveProperty('shoe');
  });
});
