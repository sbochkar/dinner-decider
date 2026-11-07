// Anonymous click counter: sends only an event type, a delivery target and a page name.
export function track(type, target = '', page = 'home') {
  try {
    const body = JSON.stringify({ type, target, page });
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/event', blob)) return;
    fetch('/api/event', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch {
    // Tracking must never get in the way.
  }
}
