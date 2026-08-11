import { LegalScreen } from '@/components/legal/legal-screen';
import { PRIVACY_POLICY } from '@/lib/legal';

export default function AppPrivacyScreen() {
  return (
    <LegalScreen
      title={PRIVACY_POLICY.title}
      intro={PRIVACY_POLICY.intro}
      sections={PRIVACY_POLICY.sections}
      otherHref="/(app)/terms"
      otherLabel="Terms of Service"
    />
  );
}
