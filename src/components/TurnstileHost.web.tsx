import React, { useEffect, useRef } from 'react';

type Props = {
  siteKey: string;
  onVerify: (token: string) => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, params: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * Виджет Cloudflare Turnstile (только web). Токен уходит на backend для siteverify.
 */
export default function TurnstileHost({ siteKey, onVerify }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !siteKey) return undefined;

    let cancelled = false;

    const mountWidget = () => {
      if (cancelled || !container || !window.turnstile) return;
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        callback: (token: string) => onVerify(token),
        'error-callback': () => onVerify(''),
        'expired-callback': () => {
          onVerify('');
          const id = widgetIdRef.current;
          if (id && window.turnstile?.reset) {
            try {
              window.turnstile.reset(id);
            } catch {
              /* ignore */
            }
          }
        },
      });
    };

    const existing = document.querySelector('script[data-cf-turnstile-api]');
    if (existing) {
      if (window.turnstile) {
        mountWidget();
      } else {
        const prev = (window as unknown as { onloadTurnstileCallback?: () => void }).onloadTurnstileCallback;
        (window as unknown as { onloadTurnstileCallback?: () => void }).onloadTurnstileCallback = () => {
          if (typeof prev === 'function') prev();
          mountWidget();
        };
      }
    } else {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      s.defer = true;
      s.setAttribute('data-cf-turnstile-api', '1');
      s.onload = () => mountWidget();
      document.head.appendChild(s);
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerify]);

  return <div ref={containerRef} style={{ minHeight: 65, width: '100%' }} />;
}
