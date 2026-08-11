import * as WebBrowser from 'expo-web-browser';

import { SUPPORT_EMAIL } from '@/lib/support-config';

export const CRISP_WEBSITE_ID = process.env.EXPO_PUBLIC_CRISP_WEBSITE_ID?.trim() || '';

export function isCrispConfigured() {
  return Boolean(CRISP_WEBSITE_ID);
}

export function crispEmbedUrl() {
  if (!CRISP_WEBSITE_ID) return null;
  return `https://go.crisp.chat/chat/embed/?website_id=${encodeURIComponent(CRISP_WEBSITE_ID)}`;
}

export async function openLiveChat() {
  const url = crispEmbedUrl();
  if (!url) return false;
  await WebBrowser.openBrowserAsync(url);
  return true;
}

export { SUPPORT_EMAIL };
