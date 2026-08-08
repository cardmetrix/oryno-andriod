import type { AppTransaction } from '@/lib/types';

export type TransactionGroup = {
  date: string;
  items: AppTransaction[];
};

export function groupTransactionsByDate(items: AppTransaction[]): TransactionGroup[] {
  const groups = new Map<string, AppTransaction[]>();

  for (const item of items) {
    const key = formatGroupLabel(item.createdAt);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return Array.from(groups.entries()).map(([date, groupItems]) => ({
    date,
    items: groupItems,
  }));
}

function formatGroupLabel(raw: string) {
  if (!raw.includes('T') && !raw.includes('-')) {
    return raw.toUpperCase();
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'EARLIER';

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);

  const pretty = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });

  if (diffDays === 0) return `TODAY · ${pretty}`;
  if (diffDays === 1) return `YESTERDAY · ${pretty}`;
  return pretty.toUpperCase();
}

export function normalizeStatusLabel(status: string) {
  const s = status.trim().toLowerCase();
  if (s.includes('fail') || s.includes('declin') || s.includes('cancel') || s.includes('revers')) {
    return 'Failed';
  }
  if (s.includes('pend') || s.includes('process') || s.includes('wait')) {
    return 'Pending';
  }
  if (s === 'completed' || s === 'success' || s.includes('complete')) {
    return 'Completed';
  }
  // Already display labels from API
  if (s === 'completed' || status === 'Completed') return 'Completed';
  if (status === 'Pending') return 'Pending';
  if (status === 'Failed') return 'Failed';
  return 'Completed';
}
