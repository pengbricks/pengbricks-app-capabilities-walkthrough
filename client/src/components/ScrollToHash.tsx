import { useEffect } from 'react';
import { useLocation } from 'react-router';

// The browser tries to jump to #hash before the app renders, so a deep link would land at the top.
// After each navigation, wait for the target element, scroll to it, and keep it in place while
// late content (code excerpts, run history) loads above it. Any user scroll or key press stops it.
const SETTLE_MS = 2500;

export function ScrollToHash() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const started = Date.now();
    let stopped = false;
    const stop = () => {
      stopped = true;
    };
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
    events.forEach((name) => window.addEventListener(name, stop, { passive: true }));
    const timer = window.setInterval(() => {
      const target = document.getElementById(id);
      if (target && !stopped && Math.abs(target.getBoundingClientRect().top) > 2) target.scrollIntoView({ block: 'start' });
      if (stopped || Date.now() - started > SETTLE_MS) window.clearInterval(timer);
    }, 100);
    return () => {
      window.clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, stop));
    };
  }, [pathname, search, hash]);
  return null;
}
