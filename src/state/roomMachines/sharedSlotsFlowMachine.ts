import { createMachine } from 'xstate';

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
