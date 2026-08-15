// Barrel for the query layer. `queries.ts` was split by domain; this re-export
// keeps every existing `from '../db/queries'` import working unchanged.
//
// Import from a specific module (e.g. './queries/food') when you only need one
// domain — the barrel exists for call-site compatibility, not as the preferred
// entry point for new code.

export * from './settings';
export * from './library';
export * from './exercises';
export * from './dayPlans';
export * from './sessions';
export * from './setLogs';
export * from './catchup';
export * from './food';
export * from './measurements';
export * from './cardio';
export * from './csv';
export * from './backup';
export * from './stretches';

// ─── Utility re-exports ───────────────────────────────────────────────

export { DAY_LABEL } from '../../types';
