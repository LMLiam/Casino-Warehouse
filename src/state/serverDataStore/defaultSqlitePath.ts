import { resolve } from 'node:path';

export const defaultSqlitePath = (): string => resolve(process.cwd(), '.casino', 'casino.sqlite');
