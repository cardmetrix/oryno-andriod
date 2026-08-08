/**
 * Bootstrapping now lives in `lib/app-boot.ts` via app/(app)/_layout.
 * Kept as a no-op hook so ApiAuthBridge import stays stable.
 */
export function usePrefetchAppData() {
  // Intentional no-op: cold/warm boot + prefetch is handled once in AppLayout.
}
