import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';

export type StatementFormat = 'pdf' | 'xlsx';

export type StatementEmailResult = {
  ok: boolean;
  emailedTo: string;
  month: string;
  periodLabel: string;
  format: StatementFormat;
  filename: string;
  count: number;
};

/** Request a PDF or Excel statement emailed to the signed-in user's account email. */
export async function emailBankStatement(opts: {
  format: StatementFormat;
  monthKey?: string | null;
}): Promise<StatementEmailResult> {
  const json = await api.post<StatementEmailResult & { error?: string }>(
    endpoints.transactions.statement,
    {
      format: opts.format,
      month: opts.monthKey ?? undefined,
    },
  );

  if (!json.ok) {
    throw new Error(json.error || 'Could not email your statement.');
  }

  return json;
}

export function confirmStatementSent(result: StatementEmailResult) {
  const kind = result.format === 'xlsx' ? 'Excel spreadsheet' : 'PDF document';
  alert.success(
    'Statement sent',
    `Your ${kind} for ${result.periodLabel} was emailed to ${result.emailedTo}.`,
  );
}
