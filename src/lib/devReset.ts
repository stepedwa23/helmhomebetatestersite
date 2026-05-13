// =============================================================================
// Dev-only: clear localStorage on every fresh `npm run dev` restart.
//
// Vite stamps a unique DEV_BOOT_ID into the bundle at server start
// (see vite.config.ts). We compare it against the value we stored in
// localStorage on the previous page load:
//
//   - First page load after `npm run dev`  → ids differ → wipe localStorage,
//     write the new id. You'll be signed out and need to sign in again.
//   - Subsequent refreshes in the same dev session → ids match → no-op.
//     Auth state persists, so you don't have to log in repeatedly.
//
// This module is dev-only. main.tsx imports it inside an `import.meta.env.DEV`
// guard, and the production bundle has `__DEV_BOOT_ID__` defined as undefined
// (Vite's `define` only fires in dev), so even if you forget to remove this,
// nothing happens in prod.
//
// TO DISABLE LATER: delete this file, the `define` block in vite.config.ts,
// and the call site in src/main.tsx.
// =============================================================================

declare const __DEV_BOOT_ID__: string | undefined

const STORAGE_KEY = '__dev_boot_id__'

export function resetIfDevBoot(): void {
  if (typeof __DEV_BOOT_ID__ === 'undefined') return
  try {
    const last = localStorage.getItem(STORAGE_KEY)
    if (last !== __DEV_BOOT_ID__) {
      localStorage.clear()
      localStorage.setItem(STORAGE_KEY, __DEV_BOOT_ID__)
      // eslint-disable-next-line no-console
      console.info('[dev] Fresh dev server boot — localStorage cleared.')
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[dev] devReset failed', err)
  }
}
