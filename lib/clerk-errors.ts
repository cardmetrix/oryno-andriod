type ClerkErr = {
  code?: string;
  longMessage?: string;
  message?: string;
  meta?: { sessionId?: string };
};

function clerkErrors(err: unknown): ClerkErr[] {
  if (!err || typeof err !== 'object') return [];
  const list = (err as { errors?: ClerkErr[] }).errors;
  return Array.isArray(list) ? list : [];
}

export function clerkErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;

  const anyErr = err as {
    errors?: Array<{ longMessage?: string; message?: string }>;
    message?: string;
  };

  const first = anyErr.errors?.[0];
  if (first?.longMessage) return first.longMessage;
  if (first?.message) return first.message;
  if (typeof anyErr.message === 'string' && anyErr.message) return anyErr.message;
  return fallback;
}

/** Clerk already has an active session — treat as signed in, don't show an error. */
export function isSessionAlreadyExistsError(err: unknown): boolean {
  const codes = clerkErrors(err).map((e) => e.code).filter(Boolean);
  if (
    codes.some(
      (c) =>
        c === 'session_exists' ||
        c === 'identifier_already_signed_in' ||
        c === 'session_exists_but_not_active',
    )
  ) {
    return true;
  }
  const msg = clerkErrorMessage(err, '').toLowerCase();
  return (
    msg.includes('session already exists') ||
    msg.includes('sessions already exists') ||
    msg.includes('already signed in')
  );
}

export function existingSessionIdFromClerkError(err: unknown): string | null {
  for (const e of clerkErrors(err)) {
    const sid = e.meta?.sessionId;
    if (typeof sid === 'string' && sid) return sid;
  }
  return null;
}

export function pickLoginSecondFactor(
  factors: Array<{ strategy: string }> | null | undefined,
): 'totp' | 'email_code' | null {
  if (!factors?.length) return null;
  if (factors.some((f) => f.strategy === 'totp')) return 'totp';
  if (factors.some((f) => f.strategy === 'email_code')) return 'email_code';
  return null;
}

/** Clerk needs the /continue (sso-continue) profile step — same as website. */
export function needsContinueFlow(errOrStatus: unknown): boolean {
  if (typeof errOrStatus === 'string') {
    return (
      errOrStatus === 'missing_requirements' ||
      /additional information|missing_requirements|continue/i.test(errOrStatus)
    );
  }
  const msg = clerkErrorMessage(errOrStatus, '');
  return /additional information|missing_requirements|continue/i.test(msg);
}
