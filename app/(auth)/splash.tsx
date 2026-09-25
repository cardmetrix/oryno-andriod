import { router } from 'expo-router';
import { useEffect } from 'react';

import { SplashLoading } from '@/components/ui/splash-loading';

export default function SplashScreen() {
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/(auth)/onboarding');
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return <SplashLoading showStatus={false} />;
}
