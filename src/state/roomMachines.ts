import { createMachine, getInitialSnapshot, getNextSnapshot, type SnapshotFrom } from 'xstate';
import type { SlotPhase } from '../game/slots';
import type { RoomSnapshot } from '../multiplayer/protocol';

export type RoomFlowPhase = RoomSnapshot['phase'];

export type RoomFlowEvent =
  | { readonly type: 'PLAYER_JOINED' }
  | { readonly type: 'START_PLAY' }
  | { readonly type: 'SETTLE' }
  | { readonly type: 'NEXT_ROUND' }
  | { readonly type: 'RESET' }
  | { readonly type: 'CLOSE' };

export const roomFlowMachine = createMachine({
  id: 'casino-room-flow',
  initial: 'lobby',
  states: {
    lobby: {
      on: {
        PLAYER_JOINED: 'betting',
        RESET: 'lobby',
        CLOSE: 'lobby',
      },
    },
    betting: {
      on: {
        START_PLAY: 'playing',
        RESET: 'betting',
        CLOSE: 'lobby',
      },
    },
    playing: {
      on: {
        SETTLE: 'settled',
        RESET: 'betting',
        CLOSE: 'lobby',
      },
    },
    settled: {
      on: {
        NEXT_ROUND: 'betting',
        RESET: 'betting',
        CLOSE: 'lobby',
      },
    },
  },
});

const roomPhaseBootEvents: Record<RoomFlowPhase, readonly RoomFlowEvent[]> = {
  lobby: [],
  betting: [{ type: 'PLAYER_JOINED' }],
  playing: [{ type: 'PLAYER_JOINED' }, { type: 'START_PLAY' }],
  settled: [{ type: 'PLAYER_JOINED' }, { type: 'START_PLAY' }, { type: 'SETTLE' }],
};

const roomAllowedEvents: Record<RoomFlowPhase, readonly RoomFlowEvent['type'][]> = {
  lobby: ['PLAYER_JOINED', 'RESET', 'CLOSE'],
  betting: ['START_PLAY', 'RESET', 'CLOSE'],
  playing: ['SETTLE', 'RESET', 'CLOSE'],
  settled: ['NEXT_ROUND', 'RESET', 'CLOSE'],
};

export const nextRoomFlowPhase = (phase: RoomFlowPhase, event: RoomFlowEvent): RoomFlowPhase => {
  const snapshot = roomPhaseBootEvents[phase].reduce<SnapshotFrom<typeof roomFlowMachine>>(
    (current, bootEvent) => getNextSnapshot(roomFlowMachine, current, bootEvent),
    getInitialSnapshot(roomFlowMachine),
  );
  return getNextSnapshot(roomFlowMachine, snapshot, event).value as RoomFlowPhase;
};

export const canRoomFlowTransition = (phase: RoomFlowPhase, event: RoomFlowEvent): boolean => roomAllowedEvents[phase].includes(event.type);

export type SharedSlotsFlowPhase = 'collecting-wagers' | 'ready-to-spin' | 'spinning' | 'bonus';

export type SharedSlotsFlowEvent =
  | { readonly type: 'SET_WAGER' }
  | { readonly type: 'READY' }
  | { readonly type: 'SPIN' }
  | { readonly type: 'BONUS_PICK' }
  | { readonly type: 'RESET' };

export const sharedSlotsFlowMachine = createMachine({
  id: 'shared-slots-flow',
  initial: 'collecting-wagers',
  states: {
    'collecting-wagers': {
      on: {
        SET_WAGER: 'collecting-wagers',
        READY: 'ready-to-spin',
        RESET: 'collecting-wagers',
      },
    },
    'ready-to-spin': {
      on: {
        SET_WAGER: 'collecting-wagers',
        SPIN: 'spinning',
        RESET: 'collecting-wagers',
      },
    },
    spinning: {
      on: {
        READY: 'ready-to-spin',
        SET_WAGER: 'collecting-wagers',
        BONUS_PICK: 'bonus',
        RESET: 'collecting-wagers',
      },
    },
    bonus: {
      on: {
        BONUS_PICK: 'bonus',
        RESET: 'collecting-wagers',
      },
    },
  },
});

const slotsPhaseBootEvents: Record<SharedSlotsFlowPhase, readonly SharedSlotsFlowEvent[]> = {
  'collecting-wagers': [],
  'ready-to-spin': [{ type: 'READY' }],
  spinning: [{ type: 'READY' }, { type: 'SPIN' }],
  bonus: [{ type: 'READY' }, { type: 'SPIN' }, { type: 'BONUS_PICK' }],
};

const slotsAllowedEvents: Record<SharedSlotsFlowPhase, readonly SharedSlotsFlowEvent['type'][]> = {
  'collecting-wagers': ['SET_WAGER', 'READY', 'RESET'],
  'ready-to-spin': ['SET_WAGER', 'SPIN', 'RESET'],
  spinning: ['READY', 'SET_WAGER', 'BONUS_PICK', 'RESET'],
  bonus: ['BONUS_PICK', 'RESET'],
};

export const deriveSharedSlotsPhase = (players: number, wageredPlayers: number, readyPlayers: number, slotPhase: SlotPhase): SharedSlotsFlowPhase => {
  if (slotPhase === 'bonus') {
    return 'bonus';
  }
  if (players > 0 && wageredPlayers >= players && readyPlayers >= players) {
    return 'ready-to-spin';
  }
  return slotPhase === 'spun' ? 'spinning' : 'collecting-wagers';
};

export const nextSharedSlotsPhase = (phase: SharedSlotsFlowPhase, event: SharedSlotsFlowEvent): SharedSlotsFlowPhase => {
  const snapshot = slotsPhaseBootEvents[phase].reduce<SnapshotFrom<typeof sharedSlotsFlowMachine>>(
    (current, bootEvent) => getNextSnapshot(sharedSlotsFlowMachine, current, bootEvent),
    getInitialSnapshot(sharedSlotsFlowMachine),
  );
  return getNextSnapshot(sharedSlotsFlowMachine, snapshot, event).value as SharedSlotsFlowPhase;
};

export const canSharedSlotsTransition = (phase: SharedSlotsFlowPhase, event: SharedSlotsFlowEvent): boolean => slotsAllowedEvents[phase].includes(event.type);
