import { clientMessageSchema } from '../../schemas/casinoSchemas/clientMessageSchema';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { ParsedMessage } from './ParsedMessage';
import { protocolVersion } from './protocolVersion';

export const parseClientMessage = (value: unknown): ParsedMessage => {
  if (!isRecord(value) || value.version !== protocolVersion || typeof value.type !== 'string') {
    return { ok: false, error: 'Message version or type is invalid.' };
  }
  if (value.type === 'join-room' && typeof value.roomId !== 'string') {
    return { ok: false, error: 'Room id is required.' };
  }

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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
