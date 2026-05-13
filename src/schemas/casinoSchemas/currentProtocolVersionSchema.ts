import { z } from 'zod';
import { currentProtocolVersion } from '../../multiplayer/protocol/currentProtocolVersion';

// Bump this only when serialized WebSocket client/server messages need a breaking wire-protocol change.
export const currentProtocolVersionSchema = z.literal(currentProtocolVersion);
