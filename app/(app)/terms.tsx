import { LegalScreen } from '@/components/legal/legal-screen';
import { TERMS_OF_SERVICE } from '@/lib/legal';

export default function AppTermsScreen() {
  return (
    <LegalScreen
      title={TERMS_OF_SERVICE.title}
      intro={TERMS_OF_SERVICE.intro}
      sections={TERMS_OF_SERVICE.sections}
      otherHref="/(app)/privacy"
      otherLabel="Privacy Policy"
    />
  );
}
