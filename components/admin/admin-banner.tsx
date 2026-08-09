import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';

type Props = {
  hasSession?: boolean;
};

/** Shown on the client home dashboard when the signed-in user is an admin. */
export function AdminAccessBanner({ hasSession }: Props) {
  return (
    <Pressable
      onPress={() =>
        router.push((hasSession ? '/(app)/admin' : '/(app)/admin/login') as never)
      }
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.94 }]}>
      <LinearGradient
        colors={['#1C1C1E', '#2C2118']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={20} color={Brand.orange} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Admin</Text>
          <Text style={styles.title}>Access your admin dashboard</Text>
          <Text style={styles.sub}>
            {hasSession ? 'Continue to the live console' : 'Unlock with your admin passcode'}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={Brand.white} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    borderRadius: 18,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,106,0,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: Brand.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    marginTop: 1,
    fontSize: 14,
    fontWeight: '800',
    color: Brand.white,
    letterSpacing: -0.2,
  },
  sub: { marginTop: 1, fontSize: 11, color: 'rgba(255,255,255,0.65)' },
});
