export type SharedSlotsFlowEvent =
  | { readonly type: 'SET_WAGER' }
  | { readonly type: 'READY' }
  | { readonly type: 'SPIN' }
  | { readonly type: 'BONUS_PICK' }
  | { readonly type: 'RESET' };
