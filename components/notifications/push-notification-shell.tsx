import { useAuth, useUser } from '@clerk/clerk-expo';
import { useEffect, useRef } from 'react';

import { NotificationEnableModal } from '@/components/notifications/notification-enable-modal';
import { usePushNotifications } from '@/context/push-notification-context';
import { useNotificationPushBridge } from '@/hooks/use-notification-push-bridge';

export function PushNotificationShell() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const {
    setClerkUserId,
    setPreferenceEnabled,
    showEnableModal,
    enableNotificationsFromModal,
    dismissEnableModal,
    isRegistering,
    configurePushNotifications,
    promptEnableAfterAuth,
    clearPushRegistration,
  } = usePushNotifications();

  const active = Boolean(isLoaded && isSignedIn && userId);
  const signedInSetupFor = useRef<string | null>(null);
  const configureRef = useRef(configurePushNotifications);
  const promptRef = useRef(promptEnableAfterAuth);

  configureRef.current = configurePushNotifications;
  promptRef.current = promptEnableAfterAuth;

  const notificationsPref =
    typeof user?.publicMetadata?.notificationsEnabled === 'boolean'
      ? Boolean(user.publicMetadata.notificationsEnabled)
      : true;

  useEffect(() => {
    setPreferenceEnabled(notificationsPref);
  }, [notificationsPref, setPreferenceEnabled]);

  useEffect(() => {
    setClerkUserId(active ? userId! : null);
    if (!active) {
      signedInSetupFor.current = null;
      void clearPushRegistration();
    }
  }, [active, clearPushRegistration, setClerkUserId, userId]);

  useEffect(() => {
    if (!active || !notificationsPref || !userId) return;
    if (signedInSetupFor.current === userId) return;
    signedInSetupFor.current = userId;

    // Delay so wallet/home requests get the network first.
    const timer = setTimeout(() => {
      void configureRef.current('sign-in', userId);
      promptRef.current();
    }, 1200);

    return () => clearTimeout(timer);
  }, [active, notificationsPref, userId]);

  useNotificationPushBridge(active && notificationsPref);

  return (
    <NotificationEnableModal
      visible={showEnableModal && active && notificationsPref}
      loading={isRegistering}
      onEnable={() => {
        void enableNotificationsFromModal();
      }}
      onDismiss={() => {
        void dismissEnableModal();
      }}
    />
  );
}
