import React, { useEffect, useRef, useCallback } from 'react';

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  onVerify,
  onExpire,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Store callbacks in refs so the useEffect doesn't re-run when they change
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  // Keep refs in sync with latest props
  useEffect(() => { onVerifyRef.current = onVerify; }, [onVerify]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const initializeTurnstile = () => {
      if (!window.turnstile || !containerRef.current || !active) return;

      // Clean up previous widget
      if (widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch (_) {}
        widgetIdRef.current = null;
      }

      // Clear container to avoid duplicates
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          callback: (token: string) => {
            if (active) onVerifyRef.current(token);
          },
          'expired-callback': () => {
            if (active && onExpireRef.current) onExpireRef.current();
          },
          'error-callback': () => {
            if (active && onErrorRef.current) onErrorRef.current();
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.error('Turnstile render error:', err);
      }
    };

    // If turnstile script is loaded, initialize, otherwise poll until ready
    if (window.turnstile) {
      initializeTurnstile();
    } else {
      interval = setInterval(() => {
        if (window.turnstile) {
          if (interval) clearInterval(interval);
          interval = null;
          initializeTurnstile();
        }
      }, 500);
    }

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch (_) {}
        widgetIdRef.current = null;
      }
    };
    // Only re-run if siteKey changes — callbacks are stored in refs
  }, [siteKey]);

  return <div ref={containerRef} className="flex justify-center my-4" />;
};

export default TurnstileWidget;
