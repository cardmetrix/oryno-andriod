export type ToastTone = 'success' | 'error' | 'message';

export type ToastPayload = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

type Listener = (toast: ToastPayload | null) => void;

let listener: Listener | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

function emit(toast: ToastPayload | null) {
  listener?.(toast);
}

export function setToastListener(next: Listener | null) {
  listener = next;
}

export function dismissToast() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  emit(null);
}

function show(tone: ToastTone, title: string, description?: string) {
  const id = `toast-${Date.now()}-${++seq}`;
  emit({ id, tone, title, description });
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    emit(null);
    hideTimer = null;
  }, description ? 4200 : 3200);
}

export const toast = {
  success(title: string, options?: { description?: string }) {
    show('success', title, options?.description);
  },
  error(title: string, options?: { description?: string }) {
    show('error', title, options?.description);
  },
  message(title: string, options?: { description?: string }) {
    show('message', title, options?.description);
  },
  dismiss: dismissToast,
};
