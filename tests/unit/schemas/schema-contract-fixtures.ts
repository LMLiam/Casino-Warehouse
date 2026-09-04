import type { BlackjackSnapshot } from '../../../src/game/blackjack/BlackjackSnapshot';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { GameSnapshot } from '../../../src/game/types/GameSnapshot';
import type { ClientMessage } from '../../../src/multiplayer/protocol/ClientMessage';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import type { RoomSummary } from '../../../src/multiplayer/protocol/RoomSummary';
import type { ServerMessage } from '../../../src/multiplayer/protocol/ServerMessage';
import type { CasinoSaveState } from '../../../src/state/profiles/CasinoSaveState';
import type { CasinoSessionState } from '../../../src/state/session/CasinoSessionState';
import {
  testBlackjackSeatId,
  testConnectionId,
  testHexColour,
  testIsoTimestamp,
  testProfileId,
  testProfileToken,
  testRoomId,
  testServerInstanceId,
  testSessionId,
  testSettlementId,
  testTransactionId,
} from './testIds';

const profileAliceId = testProfileId('profile-alice');
const profileBobId = testProfileId('profile-bob');
const profileSpectatorId = testProfileId('profile-spectator');
const room42Id = testRoomId('ROOM42');
const beat42Id = testRoomId('BEAT42');
const sessionContractId = testSessionId('session-contract');
const sessionBeatContractId = testSessionId('session-beat-contract');
const transactionBlackjackWinId = testTransactionId('tx-blackjack-win');
const transactionAt = testIsoTimestamp('2026-05-10T10:01:00.000Z');
const profileCreatedAt = testIsoTimestamp('2026-05-10T10:00:00.000Z');
const profileUpdatedAt = testIsoTimestamp('2026-05-10T10:01:00.000Z');
const sessionUpdatedAt = testIsoTimestamp('2026-05-10T10:02:00.000Z');
const sessionRestoreUpdatedAt = testIsoTimestamp('2026-05-10T10:03:00.000Z');
const blackjackSeat1 = testBlackjackSeatId('seat-1');
const blackjackSeat2 = testBlackjackSeatId('seat-2');
const connectionAlice = testConnectionId('connection-alice');
const connectionBob = testConnectionId('connection-bob');
const connectionSpectator = testConnectionId('connection-spectator');
const profileAliceToken = testProfileToken('profile-token-alice');
const serverContractId = testServerInstanceId('server-contract');
const settlementContractId = testSettlementId('settlement-contract');
const beatSettlementContractId = testSettlementId('settlement-beat-contract');

const profileStoreCurrentV1Fixture = {
  profiles: [
    {
      id: profileAliceId,
      name: 'Alice',
      color: testHexColour('#6ee7b7'),
      bankroll: 1200,
      gameCredits: { beatTheHouseHalfChip: 0 },
      houseAdvance: {
        outstandingBalance: 0,
        activeCount: 0,
      },
      stats: {
        totalWagered: 25,
        totalWon: 50,
        netProfit: 25,
        biggestWin: 50,
        biggestWager: 25,
        gamesPlayed: 1,
        perGame: {
          blackjack: {
            gamesPlayed: 1,
            wagered: 25,
            won: 50,
            netProfit: 25,
          },
        },
        favouriteGame: 'blackjack',
      },
      transactions: [
        {
          id: transactionBlackjackWinId,
          profileId: profileAliceId,
          at: transactionAt,
          gameId: 'blackjack',
          roomId: room42Id,
          sessionId: sessionContractId,
          type: 'payout',
          amount: 50,
          balanceBefore: 1150,
          balanceAfter: 1200,
          description: 'Blackjack contract win.',
          metadata: {
            handId: 'seat-1',
            wager: 25,
          },
        },
      ],
      createdAt: profileCreatedAt,
      updatedAt: profileUpdatedAt,
    },
  ],
} satisfies CasinoSaveState;

const blackjackSnapshotFixture = {
  phase: 'player',
  wager: 25,
  playerCards: [
    { rank: 'A', suit: 'spades' },
    { rank: 'K', suit: 'hearts' },
  ],
  dealerCards: [{ rank: '9', suit: 'clubs' }],
  dealerHoleHidden: true,
  insuranceWager: 0,
  splitHands: [],
  returned: 0,
  status: 'Player blackjack contract snapshot.',
} satisfies BlackjackSnapshot;

const beatSnapshotFixture = new BeatTheHouseGame({ initialBankroll: 500 }).snapshot() satisfies GameSnapshot;

const sessionStateCurrentV2Fixture = {
  profileId: profileAliceId,
  activeGame: 'blackjack',
  showingGameLobby: false,
  wagerLimit: 500,
  wagered: 25,
  gameSnapshot: {
    blackjack: blackjackSnapshotFixture,
  },
  room: {
    roomId: room42Id,
    gameId: 'blackjack',
    role: 'player',
    seatId: blackjackSeat1,
  },
  updatedAt: sessionUpdatedAt,
} satisfies CasinoSessionState;

const roomSnapshotFixture = {
  roomId: room42Id,
  roomName: 'Blackjack Contract Room',
  hostProfileId: profileAliceId,
  gameId: 'blackjack',
  gameTitle: 'Blackjack',
  status: 'in-progress',
  phase: 'playing',
  sessionId: sessionContractId,
  revision: 3,
  maxPlayers: 5,
  allowSpectators: true,
  createdAt: 1778407200000,
  updatedAt: 1778407320000,
  players: [
    {
      connectionId: connectionAlice,
      profileId: profileAliceId,
      profileName: 'Alice',
      bankroll: 1200,
      sessionStartBankroll: 1150,
      role: 'player',
    },
  ],
  spectators: [
    {
      connectionId: connectionSpectator,
      profileId: profileSpectatorId,
      profileName: 'Spectator',
      bankroll: 300,
      sessionStartBankroll: 300,
      role: 'spectator',
    },
  ],
  seats: [
    {
      seatId: blackjackSeat1,
      profileId: profileAliceId,
    },
    {
      seatId: blackjackSeat2,
    },
  ],
  game: blackjackSnapshotFixture,
} satisfies RoomSnapshot;

const beatRoomSnapshotFixture = {
  roomId: beat42Id,
  roomName: 'Beat Contract Room',
  hostProfileId: profileAliceId,
  gameId: 'beat-the-house',
  gameTitle: 'Beat the House',
  status: 'betting',
  phase: 'betting',
  sessionId: sessionBeatContractId,
  revision: 4,
  maxPlayers: 3,
  allowSpectators: true,
  createdAt: 1778407200000,
  updatedAt: 1778407320000,
  players: [
    {
      connectionId: connectionAlice,
      profileId: profileAliceId,
      profileName: 'Alice',
      bankroll: 1200,
      sessionStartBankroll: 1150,
      role: 'player',
    },
    {
      connectionId: connectionBob,
      profileId: profileBobId,
      profileName: 'Bob',
      bankroll: 900,
      sessionStartBankroll: 900,
      role: 'player',
    },
  ],
  spectators: [],
  seats: [
    {
      seatId: 'left',
      profileId: profileAliceId,
    },
    {
      seatId: 'centre',
      profileId: profileBobId,
    },
    {
      seatId: 'right',
    },
  ],
  game: beatSnapshotFixture,
  beat: {
    rebetSeatIds: ['left'],
    readyProfileIds: [profileAliceId],
    readyCount: 1,
    playerCount: 2,
    readyPhase: 'betting',
    nextRoundDeadlineAt: 1778407340000,
    nextRoundRemainingMs: 8000,
  },
} satisfies RoomSnapshot;

const roomSummaryFixture = {
  roomId: room42Id,
  roomName: 'Blackjack Contract Room',
  gameId: 'blackjack',
  gameTitle: 'Blackjack',
  hostProfileId: profileAliceId,
  maxPlayers: 5,
  currentPlayers: 1,
  spectators: 1,
  status: 'in-progress',
  createdAt: 1778407200000,
  updatedAt: 1778407320000,
} satisfies RoomSummary;

export const clientMessageContractFixtures = [
  { type: 'request-data' },
  {
    type: 'authorize-profiles',
    profileTokens: [{ profileId: profileAliceId, profileToken: profileAliceToken }],
  },
  { type: 'authorize-admin', adminToken: 'admin-token' },
  { type: 'create-profile', profileName: 'Alice' },
  { type: 'rename-profile', profileId: profileAliceId, profileName: 'Alice Renamed' },
  { type: 'delete-profile', profileId: profileAliceId },
  { type: 'house-advance', profileId: profileAliceId },
  {
    type: 'save-session',
    session: {
      profileId: sessionStateCurrentV2Fixture.profileId,
      activeGame: sessionStateCurrentV2Fixture.activeGame,
      showingGameLobby: sessionStateCurrentV2Fixture.showingGameLobby,
      wagerLimit: sessionStateCurrentV2Fixture.wagerLimit,
      wagered: sessionStateCurrentV2Fixture.wagered,
      gameSnapshot: sessionStateCurrentV2Fixture.gameSnapshot,
      room: sessionStateCurrentV2Fixture.room,
    },
  },
  { type: 'admin-bankroll', profileId: profileAliceId, action: 'add', amount: 100 },
  { type: 'admin-reset-all' },
  { type: 'clear-server-data' },
  { type: 'heartbeat-ack', sentAt: 1778407320000 },
  { type: 'list-rooms', gameId: 'blackjack' },
  {
    type: 'create-room',
    gameId: 'blackjack',
    roomName: 'Blackjack Contract Room',
    maxPlayers: 5,
    allowSpectators: true,
    profileId: profileAliceId,
    profileName: 'Alice',
    bankroll: 1200,
  },
  {
    type: 'join-room',
    gameId: 'blackjack',
    roomId: room42Id,
    role: 'player',
    seatId: blackjackSeat1,
    profileId: profileAliceId,
    profileName: 'Alice',
    bankroll: 1200,
  },
  { type: 'leave-room' },
  { type: 'assign-seat', seatId: blackjackSeat1 },
  { type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 },
  { type: 'place-tip', seatId: 'left', amount: 5 },
  { type: 'blackjack-deal', wager: 25 },
  { type: 'blackjack-action', action: 'stand' },
  { type: 'slots-wager', wager: 10 },
  { type: 'slots-ready', ready: true },
  { type: 'slots-spin' },
  { type: 'slots-pick-bonus' },
  { type: 'clear-bets' },
  { type: 'rebet' },
  { type: 'start-round' },
  { type: 'player-action', action: 'stick' },
  { type: 'next-round' },
  { type: 'admin-debug', action: 'force-settle', reason: 'contract fixture' },
  { type: 'resync' },
] satisfies readonly ClientMessage[];

export const serverMessageContractFixtures = [
  { type: 'server-hello', serverInstanceId: serverContractId },
  { type: 'reload-required', reason: 'server-restarted', message: 'Server restarted.' },
  { type: 'profile-credentials', profileId: profileAliceId, profileToken: profileAliceToken },
  { type: 'profile-access', ownedProfileIds: [profileAliceId] },
  { type: 'admin-access', authorized: true },
  { type: 'data-state', database: 'memory', profileState: profileStoreCurrentV1Fixture, session: sessionStateCurrentV2Fixture },
  { type: 'heartbeat', sentAt: 1778407320000 },
  { type: 'room-created', room: roomSnapshotFixture, invitePath: '/?room=ROOM42' },
  { type: 'room-closed', roomId: room42Id, gameId: 'blackjack', reason: 'host-left' },
  { type: 'room-list', gameId: 'blackjack', rooms: [roomSummaryFixture] },
  { type: 'room-state', room: roomSnapshotFixture },
  { type: 'room-state', room: beatRoomSnapshotFixture },
  {
    type: 'settlement',
    roomId: room42Id,
    sessionId: sessionContractId,
    settlements: [
      {
        id: settlementContractId,
        profileId: profileAliceId,
        seatId: blackjackSeat1,
        wagered: 25,
        returned: 50,
        profit: 25,
      },
    ],
  },
  {
    type: 'settlement',
    roomId: beat42Id,
    sessionId: sessionBeatContractId,
    settlements: [
      {
        id: beatSettlementContractId,
        kind: 'gameplay',
        profileId: profileAliceId,
        seatId: 'left',
        wagered: 1,
        returned: 2.5,
        profit: 1.5,
        beatTheHouse: {
          returnedHalfUnits: 5,
          profitHalfUnits: 3,
          halfChipBefore: 1,
          halfChipAfter: 0,
          wholeCreditsReleased: 3,
        },
      },
    ],
  },
  { type: 'error', code: 'invalid-message', message: 'Invalid message.' },
] satisfies readonly ServerMessage[];

export const clientProtocolInvalidFixtures = [
  { label: 'obsolete protocol field', value: { version: 1, type: 'request-data' } },
  { label: 'unknown message type', value: { type: 'select-game', gameId: 'blackjack' } },
  { label: 'missing required field', value: { type: 'join-room', gameId: 'blackjack' } },
  { label: 'invalid game action payload', value: { type: 'blackjack-action', action: 'fold' } },
] as const;

export const serverProtocolInvalidFixtures = [
  { label: 'obsolete protocol field', value: { version: 1, type: 'server-hello', serverInstanceId: 'server-contract' } },
  { label: 'unknown message type', value: { type: 'server-goodbye' } },
  { label: 'missing required field', value: { type: 'room-state' } },
  {
    label: 'invalid game payload',
    value: {
      type: 'room-list',
      gameId: 'slots:house-of-sevens',
      rooms: [],
    },
  },
] as const;

export const profileStoreContractFixtures = {
  current: profileStoreCurrentV1Fixture,
  malformed: {
    profiles: [{ id: 42, name: 'Broken Profile' }],
  },
  obsoleteVersion: {
    version: 1,
    profiles: [],
  },
} as const;

export const sessionStateContractFixtures = {
  current: sessionStateCurrentV2Fixture,
  roomRestore: {
    profileId: 'profile-bob',
    activeGame: 'blackjack',
    showingGameLobby: false,
    wagerLimit: 200,
    wagered: 50,
    gameSnapshot: {
      blackjack: {
        ...blackjackSnapshotFixture,
        phase: 'settled',
        wager: 50,
        status: 'Representative restored Blackjack snapshot.',
      },
    },
    room: {
      roomId: 'ROOM99',
      gameId: 'blackjack',
      role: 'spectator',
      seatId: 'seat-2',
    },
    updatedAt: sessionRestoreUpdatedAt,
  },
  malformed: {},
  obsoleteVersion: {
    version: 2,
    ...sessionStateCurrentV2Fixture,
  },
} as const;
