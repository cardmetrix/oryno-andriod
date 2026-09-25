import { Redirect } from 'expo-router';

/** Withdrawals removed — redirected to Cards. */
export default function WithdrawRedirect() {
  return <Redirect href="/(app)/(tabs)/cards" />;
}
