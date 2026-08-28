import type { JsonValue } from './JsonValue';
import { jsonValueSchema } from './jsonValueSchema';

export const parseJsonText = (text: string): JsonValue => jsonValueSchema.parse(JSON.parse(text));
