import type { JsonValue } from '../../schemas/casinoSchemas/JsonValue';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import { clientMessageSchema } from '../../schemas/protocol/clientMessageSchema';
import type { ParsedMessage } from './ParsedMessage';

export const parseClientMessage = (value: JsonValue): ParsedMessage => {
  const parsed = clientMessageSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: zodErrorSummary(parsed.error) };
  }
  if (parsed.data.type === 'create-room') {
    return {
      ok: true,
      message: {
        ...parsed.data,
        roomName: parsed.data.roomName,
        maxPlayers: parsed.data.maxPlayers,
        allowSpectators: parsed.data.allowSpectators,
      },
    };
  }
  return { ok: true, message: parsed.data };
};
