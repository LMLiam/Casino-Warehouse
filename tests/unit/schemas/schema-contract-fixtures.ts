import type { BlackjackSnapshot } from '../../../src/game/blackjack/BlackjackSnapshot';
import { BeatTheHouseGame } from '../../../src/game/engine/BeatTheHouseGame';
import type { GameSnapshot } from '../../../src/game/types/GameSnapshot';
import type { ClientMessage } from '../../../src/multiplayer/protocol/ClientMessage';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import type { RoomSummary } from '../../../src/multiplayer/protocol/RoomSummary';
import type { ServerMessage } from '../../../src/multiplayer/protocol/ServerMessage';
import type { CasinoSaveState } from '../../../src/state/profiles/CasinoSaveState';
import type { CasinoSessionState } from '../../../src/state/session/CasinoSessionState';

const profileStoreCurrentV1Fixture = {
  profiles: [
    {
      id: 'profile-alice',
      name: 'Alice',
      color: '#6ee7b7',
      bankroll: 1200,
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
          id: 'tx-blackjack-win',
          profileId: 'profile-alice',
          at: '2026-05-10T10:01:00.000Z',
          gameId: 'blackjack',
          roomId: 'ROOM42',
          sessionId: 'session-contract',
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
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:01:00.000Z',
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
  profileId: 'profile-alice',
  activeGame: 'blackjack',
  showingGameLobby: false,
  wagerLimit: 500,
  wagered: 25,
  gameSnapshot: {
    blackjack: blackjackSnapshotFixture,
  },
  room: {
    roomId: 'ROOM42',
    gameId: 'blackjack',
    role: 'player',
    seatId: 'seat-1',
  },
  updatedAt: '2026-05-10T10:02:00.000Z',
} satisfies CasinoSessionState;

const roomSnapshotFixture = {
  roomId: 'ROOM42',
  roomName: 'Blackjack Contract Room',
  hostProfileId: 'profile-alice',
  gameId: 'blackjack',
  gameTitle: 'Blackjack',
  status: 'in-progress',
  phase: 'playing',
  sessionId: 'session-contract',
  revision: 3,
  maxPlayers: 5,
  allowSpectators: true,
  createdAt: 1778407200000,
  updatedAt: 1778407320000,
  players: [
    {
      connectionId: 'connection-alice',
      profileId: 'profile-alice',
      profileName: 'Alice',
      bankroll: 1200,
      sessionStartBankroll: 1150,
      role: 'player',
    },
  ],
  spectators: [
    {
      connectionId: 'connection-spectator',
      profileId: 'profile-spectator',
      profileName: 'Spectator',
      bankroll: 300,
      sessionStartBankroll: 300,
      role: 'spectator',
    },
  ],
  seats: [
    {
      seatId: 'seat-1',
      profileId: 'profile-alice',
    },
    {
      seatId: 'seat-2',
    },
  ],
  game: blackjackSnapshotFixture,
} satisfies RoomSnapshot;

const beatRoomSnapshotFixture = {
  roomId: 'BEAT42',
  roomName: 'Beat Contract Room',
  hostProfileId: 'profile-alice',
  gameId: 'beat-the-house',
  gameTitle: 'Beat the House',
  status: 'betting',
  phase: 'betting',
  sessionId: 'session-beat-contract',
  revision: 4,
  maxPlayers: 3,
  allowSpectators: true,
  createdAt: 1778407200000,
  updatedAt: 1778407320000,
  players: [
    {
      connectionId: 'connection-alice',
      profileId: 'profile-alice',
      profileName: 'Alice',
      bankroll: 1200,
      sessionStartBankroll: 1150,
      role: 'player',
    },
    {
      connectionId: 'connection-bob',
      profileId: 'profile-bob',
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
      profileId: 'profile-alice',
    },
    {
      seatId: 'centre',
      profileId: 'profile-bob',
    },
    {
      seatId: 'right',
    },
  ],
  game: beatSnapshotFixture,
  beat: {
    rebetSeatIds: ['left'],
    readyProfileIds: ['profile-alice'],
    readyCount: 1,
    playerCount: 2,
    readyPhase: 'betting',
    nextRoundDeadlineAt: 1778407340000,
    nextRoundRemainingMs: 8000,
  },
} satisfies RoomSnapshot;

const roomSummaryFixture = {
  roomId: 'ROOM42',
  roomName: 'Blackjack Contract Room',
  gameId: 'blackjack',
  gameTitle: 'Blackjack',
  hostProfileId: 'profile-alice',
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
    profileTokens: [{ profileId: 'profile-alice', profileToken: 'profile-token-alice' }],
  },
  { type: 'authorize-admin', adminToken: 'admin-token' },
  { type: 'create-profile', profileName: 'Alice' },
  { type: 'rename-profile', profileId: 'profile-alice', profileName: 'Alice Renamed' },
  { type: 'delete-profile', profileId: 'profile-alice' },
  { type: 'house-advance', profileId: 'profile-alice' },
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
  { type: 'admin-bankroll', profileId: 'profile-alice', action: 'add', amount: 100 },
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
    profileId: 'profile-alice',
    profileName: 'Alice',
    bankroll: 1200,
  },
  {
    type: 'join-room',
    gameId: 'blackjack',
    roomId: 'ROOM42',
    role: 'player',
    seatId: 'seat-1',
    profileId: 'profile-alice',
    profileName: 'Alice',
    bankroll: 1200,
  },
  { type: 'leave-room' },
  { type: 'assign-seat', seatId: 'seat-1' },
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
  { type: 'server-hello', serverInstanceId: 'server-contract' },
  { type: 'reload-required', reason: 'server-restarted', message: 'Server restarted.' },
  { type: 'profile-credentials', profileId: 'profile-alice', profileToken: 'profile-token-alice' },
  { type: 'profile-access', ownedProfileIds: ['profile-alice'] },
  { type: 'admin-access', authorized: true },
  { type: 'data-state', database: 'memory', profileState: profileStoreCurrentV1Fixture, session: sessionStateCurrentV2Fixture },
  { type: 'heartbeat', sentAt: 1778407320000 },
  { type: 'room-created', room: roomSnapshotFixture, invitePath: '/?room=ROOM42' },
  { type: 'room-closed', roomId: 'ROOM42', gameId: 'blackjack', reason: 'host-left' },
  { type: 'room-list', gameId: 'blackjack', rooms: [roomSummaryFixture] },
  { type: 'room-state', room: roomSnapshotFixture },
  { type: 'room-state', room: beatRoomSnapshotFixture },
  {
    type: 'settlement',
    roomId: 'ROOM42',
    sessionId: 'session-contract',
    settlements: [
      {
        id: 'settlement-contract',
        profileId: 'profile-alice',
        seatId: 'seat-1',
        wagered: 25,
        returned: 50,
        profit: 25,
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
    updatedAt: '2026-05-10T10:03:00.000Z',
  },
  malformed: {},
  obsoleteVersion: {
    version: 2,
    ...sessionStateCurrentV2Fixture,
  },
} as const;
