import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

import { GiftCardIcon } from '@/components/icons/gift-card-icon';
import { Brand } from '@/constants/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  category?: string | null;
  title?: string;
  credit: boolean;
  size?: number;
  color?: string;
};

/** Lucide-style down-left arrow (credit / inbound). */
function ArrowDownLeftIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 7L7 17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 17H7V7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Lucide-style up-right arrow (debit / outbound). */
function ArrowUpRightIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 17L17 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 7h10v10"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function normalizeKey(raw: string) {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Resolve transaction category → icon.
 * Matches website DB categories: fund, withdraw, airtime, data, bill,
 * gift_card, social, virtual_number, etc.
 */
export function TransactionCategoryIcon({
  category,
  title = '',
  credit,
  size = 20,
  color,
}: Props) {
  const tint = color ?? (credit ? Brand.success : Brand.orange);
  const key = normalizeKey(category || title || '');
  const haystack = `${normalizeKey(category || '')} ${normalizeKey(title)}`;

  // Gift cards — custom ORYNO icon from website
  if (key.includes('gift') || haystack.includes('gift')) {
    return <GiftCardIcon size={size} color={tint} strokeWidth={1.85} />;
  }

  let ion: IoniconName | null = null;

  if (
    key === 'airtime' ||
    key.includes('airtime') ||
    haystack.includes('airtime') ||
    haystack.includes('mtn') ||
    haystack.includes('glo') ||
    haystack.includes('airtel') ||
    haystack.includes('9mobile')
  ) {
    ion = 'phone-portrait-outline';
  } else if (key === 'data' || key.includes('data') || haystack.includes('data bundle')) {
    ion = 'wifi-outline';
  } else if (
    key === 'bill' ||
    key === 'bills' ||
    key.includes('bill') ||
    haystack.includes('dstv') ||
    haystack.includes('gotv') ||
    haystack.includes('electric')
  ) {
    ion = 'flash-outline';
  } else if (
    key === 'social' ||
    key.includes('social') ||
    key.includes('boost') ||
    haystack.includes('instagram') ||
    haystack.includes('tiktok') ||
    haystack.includes('followers')
  ) {
    ion = 'trending-up-outline';
  } else if (
    key.includes('virtual_number') ||
    key.includes('number') ||
    haystack.includes('sms') ||
    haystack.includes('otp')
  ) {
    ion = 'call-outline';
  } else if (key.includes('email') || key.includes('mail') || haystack.includes('inbox')) {
    ion = 'mail-outline';
  } else if (key === 'cashback' || key.includes('cashback') || key.includes('referral')) {
    ion = 'gift-outline';
  } else if (key === 'refund' || key.includes('refund') || key.includes('revers')) {
    ion = 'refresh-outline';
  } else if (key === 'fee' || key.includes('fee')) {
    ion = 'receipt-outline';
  } else if (key === 'transfer' || key.includes('transfer')) {
    ion = 'swap-horizontal-outline';
  } else if (
    key === 'fund' ||
    key.includes('fund') ||
    key.includes('deposit') ||
    haystack.includes('wallet fund') ||
    haystack.includes('paystack')
  ) {
    return <ArrowDownLeftIcon size={size} color={tint} />;
  } else if (
    key === 'withdraw' ||
    key.includes('withdraw') ||
    key.includes('payout')
  ) {
    return <ArrowUpRightIcon size={size} color={tint} />;
  }

  if (ion) {
    return <Ionicons name={ion} size={size} color={tint} />;
  }

  // Fallback: inbound / outbound arrows (website style)
  return credit ? (
    <ArrowDownLeftIcon size={size} color={tint} />
  ) : (
    <ArrowUpRightIcon size={size} color={tint} />
  );
}
