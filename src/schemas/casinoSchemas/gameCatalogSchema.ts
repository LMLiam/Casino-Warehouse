import { z } from 'zod';
import { gameCatalogEntrySchema } from './gameCatalogEntrySchema';

export const gameCatalogSchema = z.array(gameCatalogEntrySchema).min(1);
