import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

import { GiftCardIcon } from '@/components/icons/gift-card-icon';
import { LucideGiftIcon } from '@/components/icons/lucide-gift-icon';
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
 * Cashback/referral use Lucide Gift (same as website transaction-row).
 */
export function TransactionCategoryIcon({
  category,
  title = '',
  credit,
  size = 20,
  color,
}: Props) {
  const tint = color ?? (credit ? Brand.success : Brand.orange);
  const cat = normalizeKey(category || '');
  const titleKey = normalizeKey(title || '');
  const key = cat || titleKey;
  const haystack = `${cat} ${titleKey}`;

  // Cashback / referral — check before airtime so "Airtime Cashback" stays Gift
  if (
    cat === 'cashback' ||
    cat === 'referral' ||
    key === 'cashback' ||
    key === 'referral' ||
    key.includes('cashback') ||
    haystack.includes('cashback') ||
    haystack.includes('referral')
  ) {
    return <LucideGiftIcon size={size} color={tint} strokeWidth={1.85} />;
  }

  // Gift cards — custom ORYNO icon
  if (
    cat === 'gift_card' ||
    cat === 'giftcard' ||
    key.includes('gift_card') ||
    key.includes('giftcard') ||
    (haystack.includes('gift') && !haystack.includes('cashback'))
  ) {
    return <GiftCardIcon size={size} color={tint} strokeWidth={1.85} />;
  }

  let ion: IoniconName | null = null;

  if (
    cat === 'airtime' ||
    key === 'airtime' ||
    (haystack.includes('airtime') && !haystack.includes('cashback')) ||
    haystack.includes('mtn') ||
    haystack.includes('glo') ||
    haystack.includes('airtel') ||
    haystack.includes('9mobile')
  ) {
    ion = 'phone-portrait-outline';
  } else if (cat === 'data' || key === 'data' || haystack.includes('data bundle')) {
    ion = 'wifi-outline';
  } else if (
    cat === 'bill' ||
    cat === 'bills' ||
    key.includes('bill') ||
    haystack.includes('dstv') ||
    haystack.includes('gotv') ||
    haystack.includes('electric')
  ) {
    ion = 'flash-outline';
  } else if (
    cat === 'social' ||
    key.includes('social') ||
    key.includes('boost') ||
    haystack.includes('instagram') ||
    haystack.includes('tiktok') ||
    haystack.includes('followers')
  ) {
    ion = 'trending-up-outline';
  } else if (
    key.includes('virtual_number') ||
    (key.includes('number') && !haystack.includes('gift')) ||
    haystack.includes('sms') ||
    haystack.includes('otp')
  ) {
    ion = 'call-outline';
  } else if (key.includes('email') || key.includes('mail') || haystack.includes('inbox')) {
    ion = 'mail-outline';
  } else if (key === 'refund' || key.includes('refund') || key.includes('revers')) {
    ion = 'refresh-outline';
  } else if (cat === 'fee' || key.includes('fee')) {
    ion = 'receipt-outline';
  } else if (cat === 'transfer' || key.includes('transfer')) {
    ion = 'swap-horizontal-outline';
  } else if (
    cat === 'fund' ||
    key.includes('fund') ||
    key.includes('deposit') ||
    haystack.includes('wallet fund') ||
    haystack.includes('paystack')
  ) {
    return <ArrowDownLeftIcon size={size} color={tint} />;
  } else if (
    cat === 'withdraw' ||
    key.includes('withdraw') ||
    key.includes('payout')
  ) {
    return <ArrowUpRightIcon size={size} color={tint} />;
  }

  if (ion) {
    return <Ionicons name={ion} size={size} color={tint} />;
  }

  return credit ? (
    <ArrowDownLeftIcon size={size} color={tint} />
  ) : (
    <ArrowUpRightIcon size={size} color={tint} />
  );
}
