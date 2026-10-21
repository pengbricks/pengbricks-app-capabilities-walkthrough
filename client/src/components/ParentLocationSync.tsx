import { useEffect } from 'react';
import { useLocation } from 'react-router';

// When the app is shown inside a wrapper's iframe, tell the parent page which view is open after every
// navigation, so the wrapper can mirror it in its own address bar and the link can be copied and shared.
// Message: { type: 'child-location', path: '/guides/<slug>?tab=run#section' } (path is relative to the app's base).
export function ParentLocationSync() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    if (window.parent === window) return;
    const params = new URLSearchParams(search);
    params.delete('embed'); // wrapper-only flag, not part of the view
    const query = params.toString();
    window.parent.postMessage({ type: 'child-location', path: `${pathname}${query ? `?${query}` : ''}${hash}` }, '*');
  }, [pathname, search, hash]);
  return null;
}
