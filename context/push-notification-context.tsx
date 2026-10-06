import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  handleInitialNotificationResponse,
  handleNotificationResponse,
  logNotificationContent,
  pushDebug,
  registerForPushNotificationsAsync,
  registerPushToken,
  STORAGE_KEYS,
  unregisterPushToken,
} from '@/lib/push-notifications';
import { getNotificationsModule } from '@/lib/push-notifications/module';

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown';
export type PushSetupTrigger = 'app-load' | 'sign-in' | 'main';

export interface PushSetupResult {
  token: string | null;
  permission: PushPermissionStatus;
  syncedWithBackend: boolean;
  trigger: PushSetupTrigger;
}

interface PushNotificationContextValue {
  expoPushToken: string | null;
  permissionStatus: PushPermissionStatus;
  isRegisteredWithBackend: boolean;
  isRegistering: boolean;
  showEnableModal: boolean;
  clerkUserId: string | null;
  preferenceEnabled: boolean;
  setClerkUserId: (id: string | null) => void;
  setPreferenceEnabled: (enabled: boolean) => void;
  configurePushNotifications: (
    trigger: PushSetupTrigger,
    clerkUserId?: string,
  ) => Promise<PushSetupResult>;
  enableNotificationsFromModal: () => Promise<void>;
  dismissEnableModal: () => Promise<void>;
  promptEnableAfterAuth: () => void;
  clearPushRegistration: () => Promise<void>;
}

const PushNotificationContext = createContext<PushNotificationContextValue | null>(null);

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('unknown');
  const [isRegisteredWithBackend, setIsRegisteredWithBackend] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [clerkUserId, setClerkUserIdState] = useState<string | null>(null);
  const [preferenceEnabled, setPreferenceEnabledState] = useState(true);

  const tokenRef = useRef<string | null>(null);
  const bootstrapDone = useRef(false);
  const forcePromptRef = useRef(false);
  const coldStartHandled = useRef(false);
  const syncedForUserRef = useRef<string | null>(null);
  const configureRef = useRef<
    (
      trigger: PushSetupTrigger,
      targetClerkUserId?: string,
    ) => Promise<PushSetupResult>
  >(async () => ({
    token: null,
    permission: 'unknown',
    syncedWithBackend: false,
    trigger: 'app-load',
  }));

  useEffect(() => {
    tokenRef.current = expoPushToken;
  }, [expoPushToken]);

  const setClerkUserId = useCallback((id: string | null) => {
    setClerkUserIdState(id);
  }, []);

  const setPreferenceEnabled = useCallback((enabled: boolean) => {
    setPreferenceEnabledState(enabled);
  }, []);

  const refreshPermissionStatus = useCallback(async () => {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      setPermissionStatus('undetermined');
      return 'undetermined' as const;
    }

    const settings = await Notifications.getPermissionsAsync();
    const mapped: PushPermissionStatus =
      settings.status === 'granted' ||
      settings.status === 'denied' ||
      settings.status === 'undetermined'
        ? settings.status
        : 'unknown';
    setPermissionStatus(mapped);
    return mapped;
  }, []);

  const evaluateEnableModal = useCallback(
    async (permission: PushPermissionStatus, force = false) => {
      // Don't prompt for OS push permission when native notifications aren't available
      // (e.g. Android Expo Go). In-app inbox still works without device push.
      if (!getNotificationsModule()) {
        setShowEnableModal(false);
        return;
      }
      if (permission === 'granted') {
        setShowEnableModal(false);
        await AsyncStorage.setItem(STORAGE_KEYS.notificationsEnabled, 'true');
        return;
      }
      if (force || forcePromptRef.current) {
        forcePromptRef.current = false;
        setShowEnableModal(true);
        return;
      }
      const dismissed = await AsyncStorage.getItem(STORAGE_KEYS.notificationsPromptDismissed);
      setShowEnableModal(dismissed !== 'true');
    },
    [],
  );

  const configurePushNotifications = useCallback(
    async (
      trigger: PushSetupTrigger,
      targetClerkUserId?: string,
    ): Promise<PushSetupResult> => {
      const effectiveId = targetClerkUserId ?? clerkUserId ?? undefined;
      const shouldSync = !!effectiveId && (trigger === 'sign-in' || trigger === 'main');

      if (!preferenceEnabled && trigger !== 'app-load') {
        return {
          token: null,
          permission: permissionStatus,
          syncedWithBackend: false,
          trigger,
        };
      }

      setIsRegistering(true);
      try {
        const permission = await refreshPermissionStatus();
        let token = tokenRef.current;
        if (!token || trigger !== 'main') {
          token = await registerForPushNotificationsAsync();
          setExpoPushToken(token);
        }

        let syncedWithBackend = false;
        if (shouldSync && effectiveId && token && preferenceEnabled) {
          const synced = await registerPushToken();
          syncedWithBackend = !!synced;
          if (synced) setExpoPushToken(synced);
          setIsRegisteredWithBackend(syncedWithBackend);
        }

        const result: PushSetupResult = {
          token,
          permission,
          syncedWithBackend,
          trigger,
        };
        await evaluateEnableModal(permission, trigger === 'sign-in');
        pushDebug('success', 'setup', `Complete (${trigger})`, result);
        return result;
      } catch (err) {
        pushDebug('error', 'setup', `Failed (${trigger})`, err);
        return {
          token: null,
          permission: 'unknown',
          syncedWithBackend: false,
          trigger,
        };
      } finally {
        setIsRegistering(false);
      }
    },
    [
      clerkUserId,
      evaluateEnableModal,
      permissionStatus,
      preferenceEnabled,
      refreshPermissionStatus,
    ],
  );

  useEffect(() => {
    configureRef.current = configurePushNotifications;
  }, [configurePushNotifications]);

  const enableNotificationsFromModal = useCallback(async () => {
    const trigger: PushSetupTrigger = clerkUserId ? 'main' : 'app-load';
    await configurePushNotifications(trigger, clerkUserId ?? undefined);
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.notificationsEnabled, 'true'],
      [STORAGE_KEYS.notificationsPromptDismissed, 'false'],
    ]);
    setShowEnableModal(false);
  }, [clerkUserId, configurePushNotifications]);

  const dismissEnableModal = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.notificationsPromptDismissed, 'true');
    setShowEnableModal(false);
  }, []);

  const promptEnableAfterAuth = useCallback(() => {
    forcePromptRef.current = true;
    void refreshPermissionStatus().then((permission) =>
      evaluateEnableModal(permission, true),
    );
  }, [evaluateEnableModal, refreshPermissionStatus]);

  const clearPushRegistration = useCallback(async () => {
    await unregisterPushToken(tokenRef.current);
    tokenRef.current = null;
    setExpoPushToken(null);
    setIsRegisteredWithBackend(false);
  }, []);

  useEffect(() => {
    if (bootstrapDone.current) return;
    bootstrapDone.current = true;
    void (async () => {
      const optedIn = await AsyncStorage.getItem(STORAGE_KEYS.notificationsEnabled);
      if (optedIn === 'true') {
        await configureRef.current('app-load');
        return;
      }
      await evaluateEnableModal(await refreshPermissionStatus());
    })();
  }, [evaluateEnableModal, refreshPermissionStatus]);

  useEffect(() => {
    if (!clerkUserId) {
      syncedForUserRef.current = null;
      setIsRegisteredWithBackend(false);
      return;
    }
    if (!preferenceEnabled) {
      syncedForUserRef.current = null;
      void clearPushRegistration();
      return;
    }
    // One backend sync per signed-in user session — avoids retry storms on flaky networks.
    if (syncedForUserRef.current === clerkUserId) return;

    // Wait for home/wallet traffic to settle before POSTing the device token.
    const timer = setTimeout(() => {
      void configureRef.current('main', clerkUserId).then((result) => {
        if (result.syncedWithBackend) {
          syncedForUserRef.current = clerkUserId;
        }
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, [clearPushRegistration, clerkUserId, preferenceEnabled]);

  useEffect(() => {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      void handleInitialNotificationResponse();
    }

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      logNotificationContent('received', notification);
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  const value = useMemo(
    () => ({
      expoPushToken,
      permissionStatus,
      isRegisteredWithBackend,
      isRegistering,
      showEnableModal,
      clerkUserId,
      preferenceEnabled,
      setClerkUserId,
      setPreferenceEnabled,
      configurePushNotifications,
      enableNotificationsFromModal,
      dismissEnableModal,
      promptEnableAfterAuth,
      clearPushRegistration,
    }),
    [
      expoPushToken,
      permissionStatus,
      isRegisteredWithBackend,
      isRegistering,
      showEnableModal,
      clerkUserId,
      preferenceEnabled,
      setClerkUserId,
      setPreferenceEnabled,
      configurePushNotifications,
      enableNotificationsFromModal,
      dismissEnableModal,
      promptEnableAfterAuth,
      clearPushRegistration,
    ],
  );

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) {
    throw new Error('usePushNotifications must be used within PushNotificationProvider');
  }
  return ctx;
}
