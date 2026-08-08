type Level = 'info' | 'warn' | 'error' | 'success';

export function pushDebug(level: Level, scope: string, message: string, extra?: unknown) {
  const prefix = `[ORYNO push:${scope}]`;
  if (level === 'error') {
    console.error(prefix, message, extra ?? '');
    return;
  }
  if (level === 'warn') {
    console.warn(prefix, message, extra ?? '');
    return;
  }
  console.log(prefix, message, extra ?? '');
}

export function formatPushError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { message: String(error) };
}

export function logNotificationContent(
  kind: string,
  notification: { request: { content: { title?: string | null; body?: string | null; data?: unknown } } },
) {
  pushDebug('info', kind, 'Notification content', {
    title: notification.request.content.title,
    body: notification.request.content.body,
    data: notification.request.content.data,
  });
}
