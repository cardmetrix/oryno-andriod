import { Redirect, Stack, usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminBottomNav } from '@/components/admin/admin-bottom-nav';
import { AdminHeader } from '@/components/admin/admin-header';
import { SplashLoading } from '@/components/ui/splash-loading';
import {
  adminPushScreenOptions,
  adminStackScreenOptions,
  fadeScreenOptions,
} from '@/constants/transitions';
import { AdminProvider } from '@/context/admin-context';
import { useAppTheme } from '@/context/theme-context';
import { fetchAdminMe } from '@/lib/admin/api';
import { clearAdminSessionToken } from '@/lib/admin/session';
import type { AdminSummary } from '@/lib/admin/types';

export default function AdminLayout() {
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const isLogin = pathname?.includes('/admin/login');
  const [ready, setReady] = useState(isLogin);
  const [denied, setDenied] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [admin, setAdmin] = useState<AdminSummary | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      setDenied(false);
      setNeedsLogin(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await fetchAdminMe();
        if (cancelled) return;

        if (!me.isAdmin) {
          setDenied(true);
          setReady(true);
          return;
        }

        if (!me.session) {
          await clearAdminSessionToken();
          setNeedsLogin(true);
          setReady(true);
          return;
        }

        setAdmin(me.admin ?? null);
        setDenied(false);
        setNeedsLogin(false);
        setReady(true);
      } catch {
        if (!cancelled) {
          setNeedsLogin(true);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLogin, pathname, tick]);

  if (!ready) return <SplashLoading />;

  if (!isLogin && denied) {
    return <Redirect href={'/(app)/(tabs)' as never} />;
  }

  if (!isLogin && needsLogin) {
    return <Redirect href={'/(app)/admin/login' as never} />;
  }

  const stack = (
    <Stack
      screenOptions={{
        ...adminStackScreenOptions,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" options={fadeScreenOptions} />
      <Stack.Screen name="users" />
      <Stack.Screen name="wallets" />
      <Stack.Screen name="more" />
      <Stack.Screen name="gift-cards" options={adminPushScreenOptions} />
      <Stack.Screen name="support" options={adminPushScreenOptions} />
      <Stack.Screen name="waitlist" options={adminPushScreenOptions} />
      <Stack.Screen name="transaction-pins" options={adminPushScreenOptions} />
      <Stack.Screen name="virtual-numbers" options={adminPushScreenOptions} />
      <Stack.Screen name="providers" options={adminPushScreenOptions} />
      <Stack.Screen name="pricing" options={adminPushScreenOptions} />
      <Stack.Screen name="revenue" options={adminPushScreenOptions} />
      <Stack.Screen name="bills" options={adminPushScreenOptions} />
      <Stack.Screen name="betting" options={adminPushScreenOptions} />
      <Stack.Screen name="referrals" options={adminPushScreenOptions} />
      <Stack.Screen name="notifications" options={adminPushScreenOptions} />
      <Stack.Screen name="ads" options={adminPushScreenOptions} />
      <Stack.Screen name="landing" options={adminPushScreenOptions} />
      <Stack.Screen name="testimonials" options={adminPushScreenOptions} />
      <Stack.Screen name="onboarding" options={adminPushScreenOptions} />
      <Stack.Screen name="countries" options={adminPushScreenOptions} />
      <Stack.Screen name="gateways" options={adminPushScreenOptions} />
      <Stack.Screen name="reports" options={adminPushScreenOptions} />
      <Stack.Screen name="settings" options={adminPushScreenOptions} />
    </Stack>
  );

  if (isLogin) return stack;

  return (
    <AdminProvider admin={admin} refresh={refresh}>
      <View style={[styles.shell, { backgroundColor: colors.background }]}>
        <AdminHeader />
        <View style={styles.body}>{stack}</View>
        <AdminBottomNav />
      </View>
    </AdminProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  body: { flex: 1 },
});
