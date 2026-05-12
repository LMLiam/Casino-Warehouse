import type { ClientMessage } from './ClientMessage';

export const encodeMessage = (message: ClientMessage): string => JSON.stringify(message);
