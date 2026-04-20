import { useCallback, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';

export const ACTION_COOLDOWN_MS = 3000;
export const COOLDOWN_MESSAGE = 'Подождите немного';

/**
 * Ограничивает частоту вызова действия: не чаще чем раз в cooldownMs.
 * При слишком частом нажатии показывает ненавязчивый toast (угол экрана, автоскрытие, крестик).
 */
export function useActionCooldown(cooldownMs: number = ACTION_COOLDOWN_MS) {
  const { showToast } = useToast();
  const lastRunAt = useRef(0);

  const runWithCooldown = useCallback(
    (action: () => void | Promise<void>): void => {
      const now = Date.now();
      if (now - lastRunAt.current < cooldownMs) {
        showToast(COOLDOWN_MESSAGE);
        return;
      }
      lastRunAt.current = now;
      void Promise.resolve(action());
    },
    [cooldownMs, showToast],
  );

  return runWithCooldown;
}
