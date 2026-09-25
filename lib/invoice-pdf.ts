import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getApiAccessToken, toLegacyApiPath } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { endpoints } from '@/lib/endpoints';

/** Downloads the website invoice PDF and opens the share sheet. */
export async function shareInvoicePdf(invoiceId: string, number?: string) {
  const token = await getApiAccessToken();
  const path = toLegacyApiPath(endpoints.invoices.pdf(invoiceId));
  const url = `${API_BASE_URL}${path}`;
  const safe = (number || invoiceId).replace(/[^\w.-]+/g, '-');
  const dest = `${FileSystem.cacheDirectory}invoice-${safe}.pdf`;

  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: {
      Accept: 'application/pdf',
      Authorization: token ? `Bearer ${token}` : '',
      'X-Oryno-Clerk-Token': token ?? '',
      'X-Oryno-Client': 'oryno-africa',
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error('PDF failed');
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: number ? `Invoice ${number}` : 'Invoice PDF',
    });
  }
}
