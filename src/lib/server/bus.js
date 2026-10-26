import { EventEmitter } from 'node:events';

// Kept on globalThis so Vite HMR in dev doesn't orphan open SSE streams.
export const bus = (globalThis.__pantryBus ??= new EventEmitter().setMaxListeners(100));
