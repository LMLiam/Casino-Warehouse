import type { SessionStateInput } from '../../state/session/SessionStateInput';

export interface ClientMessageCandidate {
  readonly version?: number;
  readonly type?: string;
  readonly profileTokens?: readonly { readonly profileId: string; readonly profileToken: string }[];
  readonly adminToken?: string;
  readonly profileId?: string;
  readonly profileName?: string;
  readonly bankroll?: number | string | null;
  readonly session?: SessionStateInput;
  readonly action?: string;
  readonly amount?: number | string | null;
  readonly gameId?: string;
  readonly roomName?: string;
  readonly maxPlayers?: number | string | null;
  readonly allowSpectators?: boolean | string | number | null;
  readonly roomId?: string;
  readonly role?: string;
  readonly seatId?: string;
  readonly betType?: string;
  readonly wager?: number | string | null;
  readonly ready?: boolean | string | number | null;
  readonly sentAt?: number;
  readonly reason?: string;
}
