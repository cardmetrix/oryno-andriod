export function inferDataPlanCategory(
  name: string,
): 'daily' | 'weekly' | 'monthly' {
  const lower = name.toLowerCase();

  if (/\bmonthly\b|\bmonth\b/.test(lower)) return 'monthly';
  if (/\bweekly\b|\bweek\b/.test(lower)) return 'weekly';
  if (/\bdaily\b|\b24\s*-?\s*hours?\b/.test(lower)) return 'daily';

  const dayMatch = lower.match(/(\d+)\s*-?\s*days?\b/);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    if (days <= 3) return 'daily';
    if (days <= 14) return 'weekly';
    return 'monthly';
  }

  if (/\bhours?\b/.test(lower)) return 'daily';

  return 'monthly';
}

const PLAN_TAG_RULES: { label: string; test: RegExp }[] = [
  { label: 'HOT', test: /\bhot\b/i },
  { label: 'Extra Night', test: /\bextra\s*night\b/i },
  { label: 'Night', test: /\bnight\b/i },
  { label: 'Awoof', test: /\bawoof\b/i },
  { label: 'SME', test: /\bsme\b/i },
  { label: 'Gifting', test: /\bgifting\b/i },
  { label: 'CG Lite', test: /\bcg[_\s-]?lite\b/i },
  { label: 'CG', test: /\(cg\)|\bcg\b/i },
];

export type DataPlanMeta = {
  size: string;
  validity: string;
  category: 'Daily' | 'Weekly' | 'Monthly';
  tags: string[];
  badge: string;
};

/** Pull size / validity / specialty tags from a provider plan name for card UI. */
export function parseDataPlanMeta(name: string): DataPlanMeta {
  const categoryRaw = inferDataPlanCategory(name);
  const category =
    categoryRaw === 'daily'
      ? 'Daily'
      : categoryRaw === 'weekly'
        ? 'Weekly'
        : 'Monthly';

  const sizeMatch = name.match(/(\d+(?:\.\d+)?)\s*(TB|GB|MB|kb)\b/i);
  const size = sizeMatch
    ? `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}`
    : name.split(/[·\-–—|(]/)[0]?.trim() || name;

  let validity = category;
  const hourMatch = name.match(/(\d+)\s*-?\s*hours?\b/i);
  if (categoryRaw === 'daily' && hourMatch) {
    const n = Number(hourMatch[1]);
    if (n > 0 && n < 24) {
      validity = `${n} hour${n === 1 ? '' : 's'}`;
    }
  } else if (categoryRaw === 'daily') {
    const dayMatch = name.match(/(\d+)\s*-?\s*days?\b/i);
    if (dayMatch) {
      const n = Number(dayMatch[1]);
      if (n > 1 && n <= 3) validity = `${n} days`;
    }
  }

  const tags: string[] = [];
  for (const rule of PLAN_TAG_RULES) {
    if (rule.test.test(name) && !tags.includes(rule.label)) {
      if (rule.label === 'Night' && tags.includes('Extra Night')) continue;
      if (rule.label === 'CG' && tags.includes('CG Lite')) continue;
      tags.push(rule.label);
    }
  }

  return {
    size,
    validity: validity || category,
    category,
    tags,
    badge: tags[0] || category,
  };
}

/** Build filter chips present in a plan list (duration + specialty tags). */
export function buildDataPlanFilters(names: string[]): string[] {
  const duration = new Set<string>();
  const specialty = new Set<string>();
  for (const name of names) {
    const meta = parseDataPlanMeta(name);
    duration.add(meta.category);
    for (const tag of meta.tags) specialty.add(tag);
  }
  const order = ['Daily', 'Weekly', 'Monthly'];
  const durationList = order.filter((d) => duration.has(d));
  const specialtyList = [...specialty].sort((a, b) => a.localeCompare(b));
  return [...durationList, ...specialtyList];
}

export function planMatchesFilter(name: string, filter: string): boolean {
  if (!filter || filter === 'All') return true;
  const meta = parseDataPlanMeta(name);
  if (meta.category === filter) return true;
  return meta.tags.some((t) => t.toLowerCase() === filter.toLowerCase());
}
