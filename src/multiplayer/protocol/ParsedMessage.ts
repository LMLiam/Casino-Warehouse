import type { ClientMessage } from './ClientMessage';

export interface ParsedMessage {
  readonly ok: boolean;
  readonly message?: ClientMessage;
  readonly error?: string;
}
