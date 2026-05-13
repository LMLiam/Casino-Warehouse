import type { ServerMessage } from './ServerMessage';
import { ServerMessageValidator } from './ServerMessageValidator';

export const decodeServerMessage = (data: string): ServerMessage | undefined => {
  try {
    const value: unknown = JSON.parse(data);
    return ServerMessageValidator.isServerMessage(value) ? value : undefined;
  } catch {
    return undefined;
  }
};
