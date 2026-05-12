import { createMachine } from 'xstate';

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
