import type { AudioElements } from './AudioElements';
import type { BeatTableElements } from './BeatTableElements';
import type { BlackjackElements } from './BlackjackElements';
import type { DebugElements } from './DebugElements';
import type { LayoutElements } from './LayoutElements';
import type { ProfileElements } from './ProfileElements';
import type { RoomElements } from './RoomElements';
import type { SlotsElements } from './SlotsElements';
import type { WalletElements } from './WalletElements';

/**
 * Complete typed DOM element interface for the Casino Warehouse app.
 *
 * This interface composes domain-focused element groups:
 * - Layout elements for main shell and navigation
 * - Profile elements for account management
 * - Audio elements for sound settings
 * - Room elements for multiplayer
 * - Wallet elements for bankroll display
 * - Game-specific elements (Beat, Blackjack, Slots)
 * - Debug elements for admin functions
 *
 * Access elements through AppElements type-safe properties.
 * This ensures type-safe DOM queries and guarantees element existence at runtime.
 */
export interface AppElements
  extends AudioElements, BeatTableElements, BlackjackElements, DebugElements, LayoutElements, ProfileElements, RoomElements, SlotsElements, WalletElements {}
