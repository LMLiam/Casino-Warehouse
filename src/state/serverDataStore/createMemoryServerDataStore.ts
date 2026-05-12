import { MemoryServerDataStore } from './MemoryServerDataStore';
import type { ServerDataStore } from './ServerDataStore';

export const createMemoryServerDataStore = (): ServerDataStore => new MemoryServerDataStore();
