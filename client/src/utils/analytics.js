// Product analytics (PostHog) — optional integration.
//
// Mirrors the server's "optional key" convention (Groq, Tavily, email): with no
// VITE_POSTHOG_KEY set, every export here is a no-op, so local dev and any build
// without the key behave exactly as before. The key is a *public* project API
// key (safe to ship in the client bundle); it only allows event ingestion.
//
// What we get for the launch: pageviews + autocaptured clicks (feature usage),
// identified users (DAU/WAU/MAU + retention curves), and named funnel events.
import posthog from 'posthog-js';

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let enabled = false;

export function initAnalytics() {
  if (enabled || !KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    // We capture pageviews manually on route change (SPA) — see App.jsx — so
    // disable the built-in one to avoid a double-count on the first paint.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
  });
  enabled = true;
}

// Tie events to a stable user id so we can measure retention per real person.
export function identifyUser(user) {
  if (!enabled || !user) return;
  posthog.identify(user._id || user.id, {
    role: user.role,
    name: user.name,
    email: user.email,
    college: user.college,
    graduationYear: user.graduationYear,
  });
}

export function trackEvent(name, props) {
  if (!enabled) return;
  posthog.capture(name, props);
}

export function trackPageview(path) {
  if (!enabled) return;
  posthog.capture('$pageview', path ? { $current_url: window.location.origin + path } : undefined);
}

// Clear identity on logout so the next user on a shared device isn't conflated.
export function resetAnalytics() {
  if (!enabled) return;
  posthog.reset();
}
