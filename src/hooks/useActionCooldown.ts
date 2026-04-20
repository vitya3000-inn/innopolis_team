import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

export const ACTION_COOLDOWN_MS = 3000;
export const COOLDOWN_MESSAGE = 'Подождите немного';

/**
 * Ограничивает частоту вызова действия: не чаще чем раз в cooldownMs.
 * При слишком частом нажатии показывает Alert с COOLDOWN_MESSAGE.
 */
export function useActionCooldown(cooldownMs: number = ACTION_COOLDOWN_MS) {
  const lastRunAt = useRef(0);

  const runWithCooldown = useCallback(
    (action: () => void | Promise<void>): void => {
      const now = Date.now();
      if (now - lastRunAt.current < cooldownMs) {
        Alert.alert('', COOLDOWN_MESSAGE);
        return;
      }
      lastRunAt.current = now;
      void Promise.resolve(action());
    },
    [cooldownMs],
  );

  return runWithCooldown;
}
