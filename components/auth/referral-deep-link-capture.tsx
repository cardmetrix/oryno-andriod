import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { persistReferralCode } from '@/lib/referrals';

function extractReferralCode(url: string | null) {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const q = parsed.queryParams || {};
    const raw = q.ref ?? q.referral ?? q.referralCode;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  } catch {
    // ignore
  }
  return null;
}

/** Persist `?ref=` / referral deep-link params for signup sync. */
export function ReferralDeepLinkCapture() {
  useEffect(() => {
    let active = true;

    const capture = (url: string | null) => {
      const code = extractReferralCode(url);
      if (code && active) void persistReferralCode(code);
    };

    void Linking.getInitialURL().then(capture);
    const sub = Linking.addEventListener('url', ({ url }) => capture(url));

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return null;
}
