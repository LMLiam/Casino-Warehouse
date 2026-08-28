import type { BlackjackTableSnapshot } from './BlackjackTableSnapshot';

export const isBlackjackTableSnapshot = (
  snapshot: BlackjackTableSnapshot | { readonly phase?: string; readonly kind?: string } | null,
): snapshot is BlackjackTableSnapshot => snapshot !== null && snapshot.kind === 'blackjack-table';
