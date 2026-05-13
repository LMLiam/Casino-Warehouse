import { serverMessageSchema } from '../../schemas/protocol/serverMessageSchema';
import type { ServerMessage } from './ServerMessage';

export const decodeServerMessage = (data: string): ServerMessage | undefined => {
  try {
    const parsed = serverMessageSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};
