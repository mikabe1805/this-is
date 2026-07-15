import type { SignalVisibility } from './signals.js'

/** New personal memories are private; legacy circle rows remain readable only
 * long enough to migrate or explicitly retire them. */
export function nextPersonalVisibility(existing: unknown): SignalVisibility {
  return existing === 'circle' ? 'circle' : 'private'
}
