import { LegalScreen } from '@/components/legal/legal-screen';
import { TERMS_OF_SERVICE } from '@/lib/legal';

export default function TermsScreen() {
  return (
    <LegalScreen
      title={TERMS_OF_SERVICE.title}
      intro={TERMS_OF_SERVICE.intro}
      sections={TERMS_OF_SERVICE.sections}
      otherHref="/(auth)/privacy"
      otherLabel="Privacy Policy"
    />
  );
}
