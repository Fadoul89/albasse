import { Platform } from 'react-native';

const PIXEL_ID = 'DA3G12RC77U6E65BDEGG';

declare global {
  interface Window {
    ttq?: any;
  }
}

let initialized = false;

export function initTikTokPixel() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || initialized) return;
  initialized = true;

  const w = window as any;
  const ttq = (w.TiktokAnalyticsObject = 'ttq');
  w[ttq] = w[ttq] || [];
  const t = w[ttq];
  t.methods = [
    'page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready',
    'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent',
  ];
  t.setAndDefer = function (target: any, method: string) {
    target[method] = function (...args: any[]) {
      target.push([method, ...args]);
    };
  };
  for (let i = 0; i < t.methods.length; i++) t.setAndDefer(t, t.methods[i]);
  t.instance = function (id: string) {
    let e = t._i[id] || [];
    for (let n = 0; n < t.methods.length; n++) t.setAndDefer(e, t.methods[n]);
    return e;
  };
  t.load = function (e: string) {
    const r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    t._i = t._i || {};
    t._i[e] = [];
    t._i[e]._u = r;
    t._t = t._t || {};
    t._t[e] = +new Date();
    t._o = t._o || {};
    t._o[e] = {};
    const n = document.createElement('script');
    n.type = 'text/javascript';
    n.async = true;
    n.src = `${r}?sdkid=${e}&lib=${ttq}`;
    const s = document.getElementsByTagName('script')[0];
    s.parentNode?.insertBefore(n, s);
  };

  t.load(PIXEL_ID);
  t.page();
}

export function trackTikTokEvent(event: string, params?: Record<string, unknown>) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  (window as any).ttq?.track(event, params);
}
