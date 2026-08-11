import { LegalScreen } from '@/components/legal/legal-screen';
import { PRIVACY_POLICY } from '@/lib/legal';

export default function PrivacyScreen() {
  return (
    <LegalScreen
      title={PRIVACY_POLICY.title}
      intro={PRIVACY_POLICY.intro}
      sections={PRIVACY_POLICY.sections}
      otherHref="/(auth)/terms"
      otherLabel="Terms of Service"
    />
  );
}
