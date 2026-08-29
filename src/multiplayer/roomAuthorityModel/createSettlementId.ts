import type { RandomInt } from './RandomInt';
import type { SettlementId } from '../../schemas/casinoSchemas/SettlementId';
import { settlementIdSchema } from '../../schemas/casinoSchemas/settlementIdSchema';
import { createId } from './createId';

export const createSettlementId = (randomInt?: RandomInt): SettlementId => settlementIdSchema.parse(createId('settlement', randomInt));
