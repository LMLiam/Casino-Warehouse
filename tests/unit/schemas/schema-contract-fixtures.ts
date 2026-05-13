import type { BlackjackSnapshot } from '../../../src/game/blackjack/BlackjackSnapshot';
import type { ClientMessage } from '../../../src/multiplayer/protocol/ClientMessage';
import type { RoomSnapshot } from '../../../src/multiplayer/protocol/RoomSnapshot';
import type { RoomSummary } from '../../../src/multiplayer/protocol/RoomSummary';
import type { ServerMessage } from '../../../src/multiplayer/protocol/ServerMessage';
import type { CasinoSaveState } from '../../../src/state/profiles/CasinoSaveState';
import type { CasinoSessionState } from '../../../src/state/session/CasinoSessionState';

const profileStoreCurrentV1Fixture = {
  version: 1,
  profiles: [
    {
      id: 'profile-alice',
      name: 'Alice',
      color: '#6ee7b7',
      bankroll: 1200,
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

const sessionStateCurrentV1Fixture = {
  version: 1,
  profileIds: ['profile-alice'],
  selectedPlayerIndex: 0,
  activeGame: 'blackjack',
  showingGameLobby: false,
  wagerLimit: 500,
  wagered: 25,
  gameSnapshots: {
    'profile-alice': {
      blackjack: blackjackSnapshotFixture,
    },
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
  { version: 1, type: 'request-data' },
  {
    version: 1,
    type: 'authorize-profiles',
    profileTokens: [{ profileId: 'profile-alice', profileToken: 'profile-token-alice' }],
  },
  { version: 1, type: 'authorize-admin', adminToken: 'admin-token' },
  { version: 1, type: 'create-profile', profileName: 'Alice' },
  { version: 1, type: 'rename-profile', profileId: 'profile-alice', profileName: 'Alice Renamed' },
  { version: 1, type: 'delete-profile', profileId: 'profile-alice' },
  { version: 1, type: 'save-session', session: sessionStateCurrentV1Fixture },
  { version: 1, type: 'admin-bankroll', profileId: 'profile-alice', action: 'add', amount: 100 },
  { version: 1, type: 'admin-reset-all' },
  { version: 1, type: 'clear-server-data' },
  { version: 1, type: 'heartbeat-ack', sentAt: 1778407320000 },
  { version: 1, type: 'list-rooms', gameId: 'blackjack' },
  {
    version: 1,
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
    version: 1,
    type: 'join-room',
    gameId: 'blackjack',
    roomId: 'ROOM42',
    role: 'player',
    seatId: 'seat-1',
    profileId: 'profile-alice',
    profileName: 'Alice',
    bankroll: 1200,
  },
  { version: 1, type: 'leave-room' },
  { version: 1, type: 'assign-seat', seatId: 'seat-1' },
  { version: 1, type: 'place-chip', seatId: 'left', betType: 'main', amount: 25 },
  { version: 1, type: 'blackjack-deal', wager: 25 },
  { version: 1, type: 'blackjack-action', action: 'stand' },
  { version: 1, type: 'slots-wager', wager: 10 },
  { version: 1, type: 'slots-ready', ready: true },
  { version: 1, type: 'slots-spin' },
  { version: 1, type: 'slots-pick-bonus' },
  { version: 1, type: 'clear-bets' },
  { version: 1, type: 'rebet' },
  { version: 1, type: 'start-round' },
  { version: 1, type: 'player-action', action: 'stick' },
  { version: 1, type: 'next-round' },
  { version: 1, type: 'admin-debug', action: 'force-settle', reason: 'contract fixture' },
  { version: 1, type: 'resync' },
] satisfies readonly ClientMessage[];

export const serverMessageContractFixtures = [
  { version: 1, type: 'server-hello', serverInstanceId: 'server-contract' },
  { version: 1, type: 'reload-required', reason: 'server-restarted', message: 'Server restarted.' },
  { version: 1, type: 'profile-credentials', profileId: 'profile-alice', profileToken: 'profile-token-alice' },
  { version: 1, type: 'profile-access', ownedProfileIds: ['profile-alice'] },
  { version: 1, type: 'admin-access', authorized: true },
  { version: 1, type: 'data-state', database: 'memory', profileState: profileStoreCurrentV1Fixture, session: sessionStateCurrentV1Fixture },
  { version: 1, type: 'heartbeat', sentAt: 1778407320000 },
  { version: 1, type: 'room-created', room: roomSnapshotFixture, invitePath: '/?room=ROOM42' },
  { version: 1, type: 'room-closed', roomId: 'ROOM42', gameId: 'blackjack', reason: 'host-left' },
  { version: 1, type: 'room-list', gameId: 'blackjack', rooms: [roomSummaryFixture] },
  { version: 1, type: 'room-state', room: roomSnapshotFixture },
  {
    version: 1,
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
  { version: 1, type: 'error', code: 'invalid-message', message: 'Invalid message.' },
] satisfies readonly ServerMessage[];

export const clientProtocolInvalidFixtures = [
  { label: 'wrong protocol version', value: { version: 2, type: 'request-data' } },
  { label: 'unknown message type', value: { version: 1, type: 'select-game', gameId: 'blackjack' } },
  { label: 'missing required field', value: { version: 1, type: 'join-room', gameId: 'blackjack' } },
  { label: 'invalid game action payload', value: { version: 1, type: 'blackjack-action', action: 'fold' } },
] as const;

export const serverProtocolInvalidFixtures = [
  { label: 'wrong protocol version', value: { version: 2, type: 'server-hello', serverInstanceId: 'server-contract' } },
  { label: 'unknown message type', value: { version: 1, type: 'server-goodbye' } },
  { label: 'missing required field', value: { version: 1, type: 'room-state' } },
  {
    label: 'invalid game payload',
    value: {
      version: 1,
      type: 'room-list',
      gameId: 'slots:house-of-sevens',
      rooms: [],
    },
  },
] as const;

export const profileStoreContractFixtures = {
  currentV1: profileStoreCurrentV1Fixture,
  legacyV1: {
    version: 1,
    profiles: [
      {
        id: 'legacy-profile',
        name: ' Legacy Player ',
        bankroll: 75.9,
        stats: {
          totalWagered: 10,
          totalWon: 20,
          biggestWin: 20,
          gamesPlayed: 1,
        },
        transactions: [
          {
            id: 'legacy-push',
            gameId: 'blackjack',
            type: 'push',
            amount: 10,
            balanceAfter: 75,
            note: 'Legacy push refund.',
          },
          {
            id: 'legacy-admin',
            gameId: 'admin',
            type: 'admin',
            amount: 5,
            balanceAfter: 80,
            note: 'Legacy admin adjustment.',
          },
        ],
      },
    ],
  },
  malformedV1: {
    version: 1,
    profiles: [{ id: 42, name: 'Broken Profile' }],
  },
  unsupportedVersion: {
    version: 2,
    profiles: [],
  },
} as const;

export const sessionStateContractFixtures = {
  currentV1: sessionStateCurrentV1Fixture,
  roomRestoreV1: {
    version: 1,
    profileIds: ['profile-bob'],
    selectedPlayerIndex: 0,
    activeGame: 'blackjack',
    showingGameLobby: false,
    wagerLimit: 200,
    wagered: 50,
    gameSnapshots: {
      'profile-bob': {
        blackjack: {
          phase: 'settled',
          wager: 50,
          status: 'Representative restored Blackjack snapshot.',
        },
      },
    },
    room: {
      roomId: 'room99',
      gameId: 'blackjack',
      role: 'spectator',
      seatId: 'seat-2',
    },
    updatedAt: '2026-05-10T10:03:00.000Z',
  },
  malformedV1: {
    version: 1,
  },
  unsupportedVersion: {
    version: 2,
    profileIds: [],
  },
} as const;
