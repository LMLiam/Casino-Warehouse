import type { BlackjackTableSnapshot } from './BlackjackTableSnapshot';

export const isBlackjackTableSnapshot = (snapshot: unknown): snapshot is BlackjackTableSnapshot =>
  typeof snapshot === 'object' && snapshot !== null && 'kind' in snapshot && (snapshot as { kind?: unknown }).kind === 'blackjack-table';
