import { FadeIn } from 'react-native-reanimated';

/**
 * Light content fade used inside pushed screens.
 * Avoid FadeInDown + spring — those fight native stack transitions.
 */
export function cardEntering(delayMs = 0) {
  return FadeIn.delay(delayMs).duration(150);
}
