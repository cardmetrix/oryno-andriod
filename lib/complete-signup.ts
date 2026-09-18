import { isValidUsername, normalizeUsername } from '@/lib/username';

export type ContinueProfile = {
  username?: string;
  fullName?: string;
  phone?: string;
  legalAccepted?: boolean;
};

type SignUpLike = {
  status: string | null;
  missingFields?: string[] | null;
  update: (params: Record<string, unknown>) => Promise<SignUpLike>;
};

function splitName(fullName?: string) {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return { firstName: undefined, lastName: undefined };
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || undefined,
    lastName: rest.join(' ') || undefined,
  };
}

/** Apply any Clerk missing fields we can fill from the user profile. */
export async function applyMissingSignUpFields(
  signUp: SignUpLike,
  profile: ContinueProfile,
): Promise<SignUpLike> {
  const missing = new Set(signUp.missingFields ?? []);
  if (missing.size === 0 && signUp.status === 'complete') {
    return signUp;
  }

  const { firstName, lastName } = splitName(profile.fullName);
  const username = profile.username
    ? normalizeUsername(profile.username)
    : undefined;

  const update: Record<string, unknown> = {};

  if (missing.has('username') && username && isValidUsername(username)) {
    update.username = username;
  }
  if (missing.has('first_name') && firstName) {
    update.firstName = firstName;
  }
  if (missing.has('last_name') && lastName) {
    update.lastName = lastName;
  }
  if (missing.has('legal_accepted') && profile.legalAccepted !== false) {
    update.legalAccepted = true;
  }
  if (missing.has('phone_number') && profile.phone?.trim()) {
    update.phoneNumber = profile.phone.trim();
  }

  // When Clerk lists no fields but signup isn't complete, still send profile
  // (common after OAuth / transferred sign-up).
  if (Object.keys(update).length === 0 && signUp.status !== 'complete') {
    if (username && isValidUsername(username)) update.username = username;
    if (firstName) {
      update.firstName = firstName;
      update.lastName = lastName || firstName;
    }
    if (profile.legalAccepted !== false) update.legalAccepted = true;
    if (profile.phone?.trim()) update.phoneNumber = profile.phone.trim();
    if (profile.fullName?.trim()) {
      update.unsafeMetadata = {
        fullName: profile.fullName.trim(),
        ...(profile.phone?.trim() ? { phone: profile.phone.trim() } : {}),
      };
    }
  }

  if (Object.keys(update).length === 0) {
    return signUp;
  }

  return signUp.update(update);
}
