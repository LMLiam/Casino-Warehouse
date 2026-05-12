export type RoomFlowEvent =
  | { readonly type: 'PLAYER_JOINED' }
  | { readonly type: 'START_PLAY' }
  | { readonly type: 'SETTLE' }
  | { readonly type: 'NEXT_ROUND' }
  | { readonly type: 'RESET' }
  | { readonly type: 'CLOSE' };
