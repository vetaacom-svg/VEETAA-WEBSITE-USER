/**
 * Runtime logging policy:
 * - Dev: keep native console behavior (debugging friendly)
 * - Prod: silence non-critical console noise for cleaner client runtime
 */
export function setupRuntimeLogging(): void {
  if (import.meta.env.DEV) return;

  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
}

