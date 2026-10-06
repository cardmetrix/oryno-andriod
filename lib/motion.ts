import { FadeIn } from 'react-native-reanimated';

/**
 * Soft enter for stacked cards. Duration 0 keeps navigation snappy while
 * remaining chainable (`.delay()` / `.duration()`) so callers never crash.
 */
export function cardEntering(delayMs = 0) {
  return FadeIn.delay(delayMs).duration(0);
}
