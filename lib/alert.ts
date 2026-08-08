export type AlertTone = 'error' | 'success' | 'warning' | 'info' | 'confirm';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AlertPayload = {
  id: string;
  tone: AlertTone;
  title: string;
  message?: string;
  buttons: AlertButton[];
  dismissible?: boolean;
};

type Listener = (alert: AlertPayload | null) => void;

let listener: Listener | null = null;
let seq = 0;
let current: AlertPayload | null = null;

function emit(next: AlertPayload | null) {
  current = next;
  listener?.(next);
}

export function setAlertListener(next: Listener | null) {
  listener = next;
  if (listener && current) listener(current);
}

export function dismissAlert() {
  emit(null);
}

function show(payload: Omit<AlertPayload, 'id'>) {
  const id = `alert-${Date.now()}-${++seq}`;
  emit({ ...payload, id });
  return id;
}

function defaultOkButton(onPress?: () => void): AlertButton[] {
  return [{ text: 'OK', style: 'default', onPress }];
}

/**
 * Imperative alerts / error sheets — drop-in style helpers for the whole app.
 * Prefer these over React Native `Alert.alert`.
 */
export const alert = {
  show(options: {
    tone?: AlertTone;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    dismissible?: boolean;
  }) {
    return show({
      tone: options.tone ?? 'info',
      title: options.title,
      message: options.message,
      buttons: options.buttons?.length ? options.buttons : defaultOkButton(),
      dismissible: options.dismissible !== false,
    });
  },

  /** Convenience: mirrors `Alert.alert(title, message?, buttons?)`. */
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const tone: AlertTone =
      buttons?.some((b) => b.style === 'destructive') ? 'confirm' : 'info';
    return show({
      tone,
      title,
      message,
      buttons: buttons?.length ? buttons : defaultOkButton(),
      dismissible: true,
    });
  },

  error(title: string, message?: string, onOk?: () => void) {
    return show({
      tone: 'error',
      title,
      message,
      buttons: defaultOkButton(onOk),
      dismissible: true,
    });
  },

  success(title: string, message?: string, onOk?: () => void) {
    return show({
      tone: 'success',
      title,
      message,
      buttons: defaultOkButton(onOk),
      dismissible: true,
    });
  },

  warning(title: string, message?: string, onOk?: () => void) {
    return show({
      tone: 'warning',
      title,
      message,
      buttons: defaultOkButton(onOk),
      dismissible: true,
    });
  },

  info(title: string, message?: string, onOk?: () => void) {
    return show({
      tone: 'info',
      title,
      message,
      buttons: defaultOkButton(onOk),
      dismissible: true,
    });
  },

  confirm(
    title: string,
    message?: string,
    options?: {
      confirmLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
      onConfirm?: () => void;
      onCancel?: () => void;
    },
  ) {
    return show({
      tone: 'confirm',
      title,
      message,
      dismissible: true,
      buttons: [
        {
          text: options?.cancelLabel ?? 'Cancel',
          style: 'cancel',
          onPress: options?.onCancel,
        },
        {
          text: options?.confirmLabel ?? 'Confirm',
          style: options?.destructive ? 'destructive' : 'default',
          onPress: options?.onConfirm,
        },
      ],
    });
  },

  dismiss: dismissAlert,
};
