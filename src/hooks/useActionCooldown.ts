import { useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';

export const ACTION_COOLDOWN_MS = 3000;
export const COOLDOWN_MESSAGE = 'Подождите немного';

function showCooldownAlert() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(COOLDOWN_MESSAGE);
      return;
    }
  }
  Alert.alert('', COOLDOWN_MESSAGE);
}

/**
 * Ограничивает частоту вызова действия: не чаще чем раз в cooldownMs.
 * При слишком частом нажатии показывает Alert с COOLDOWN_MESSAGE.
 * На вебе используется window.alert — нативный Alert из react-native-web часто не виден.
 */
export function useActionCooldown(cooldownMs: number = ACTION_COOLDOWN_MS) {
  const lastRunAt = useRef(0);

  const runWithCooldown = useCallback(
    (action: () => void | Promise<void>): void => {
      const now = Date.now();
      if (now - lastRunAt.current < cooldownMs) {
        showCooldownAlert();
        return;
      }
      lastRunAt.current = now;
      void Promise.resolve(action());
    },
    [cooldownMs],
  );

  return runWithCooldown;
}
