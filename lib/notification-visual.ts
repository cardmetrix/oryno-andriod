import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import { Brand } from '@/constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type NotificationVisual = {
  icon: IoniconName;
  bg: string;
  fg: string;
};

export function notificationVisual(type: string | undefined): NotificationVisual {
  switch (type) {
    case 'fund':
      return { icon: 'arrow-down-outline', bg: 'rgba(52,199,89,0.12)', fg: Brand.success };
    case 'withdraw':
      return { icon: 'arrow-up-outline', bg: Brand.orangeMuted, fg: Brand.orange };
    case 'success':
    case 'service':
      return { icon: 'checkmark-circle-outline', bg: 'rgba(52,199,89,0.12)', fg: Brand.success };
    case 'error':
      return { icon: 'close-circle-outline', bg: 'rgba(255,59,48,0.12)', fg: Brand.error };
    case 'promo':
      return { icon: 'gift-outline', bg: Brand.orangeMuted, fg: Brand.orange };
    case 'kyc':
      return { icon: 'shield-checkmark-outline', bg: Brand.orangeMuted, fg: Brand.orange };
    case 'security':
      return { icon: 'shield-outline', bg: 'rgba(255,59,48,0.12)', fg: Brand.error };
    case 'system':
      return { icon: 'settings-outline', bg: 'rgba(142,142,147,0.16)', fg: '#636366' };
    default:
      return { icon: 'notifications-outline', bg: Brand.orangeMuted, fg: Brand.orange };
  }
}
