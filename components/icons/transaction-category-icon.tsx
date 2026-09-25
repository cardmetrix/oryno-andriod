import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { LucideGiftIcon } from '@/components/icons/lucide-gift-icon';
import { Brand } from '@/constants/theme';

type Props = {
  category?: string | null;
  title?: string;
  credit: boolean;
  size?: number;
  color?: string;
};

type Glyph =
  | 'wifi'
  | 'smartphone'
  | 'zap'
  | 'gift'
  | 'trending'
  | 'trophy'
  | 'phone'
  | 'percent'
  | 'store'
  | 'down-left'
  | 'up-right';

const STROKE = 2.1;

function normalizeKey(raw: string) {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Same category → glyph map as the website transaction row. */
function glyphFor(category: string | undefined, title: string, credit: boolean): Glyph {
  const cat = normalizeKey(category || '');
  const titleKey = normalizeKey(title || '');

  if (cat === 'data') return 'wifi';
  if (cat === 'airtime') return 'smartphone';
  if (cat === 'bill' || cat === 'bills' || cat === 'electricity') return 'zap';
  if (cat === 'gift_card' || cat === 'giftcard') return 'gift';
  if (cat === 'referral' || cat === 'cashback') return 'gift';
  if (cat === 'social') return 'trending';
  if (cat === 'betting') return 'trophy';
  if (cat === 'virtual_number' || cat === 'numbers' || cat === 'email') return 'phone';
  if (cat === 'fee') return 'percent';
  if (cat === 'fund' || cat === 'refund') return 'down-left';
  if (cat === 'withdraw' || cat === 'transfer') return credit ? 'down-left' : 'up-right';
  if (cat === 'convert' || cat === 'usd') return 'store';
  if (cat) return credit ? 'down-left' : 'up-right';

  if (titleKey.includes('data')) return 'wifi';
  if (titleKey.includes('airtime') || titleKey.includes('mtn') || titleKey.includes('airtel')) {
    return 'smartphone';
  }
  if (titleKey.includes('bill') || titleKey.includes('dstv') || titleKey.includes('electric')) {
    return 'zap';
  }
  if (titleKey.includes('gift') || titleKey.includes('cashback') || titleKey.includes('referral')) {
    return 'gift';
  }
  if (titleKey.includes('boost') || titleKey.includes('social')) return 'trending';
  if (titleKey.includes('bet')) return 'trophy';
  if (titleKey.includes('sms') || titleKey.includes('email') || titleKey.includes('mail')) {
    return 'phone';
  }
  if (titleKey.includes('fee')) return 'percent';
  if (titleKey.includes('fund') || titleKey.includes('deposit') || titleKey.includes('refund')) {
    return 'down-left';
  }
  if (titleKey.includes('withdraw') || titleKey.includes('payout') || titleKey.includes('transfer')) {
    return credit ? 'down-left' : 'up-right';
  }
  if (titleKey.includes('convert') || titleKey.includes('usd')) return 'store';

  return credit ? 'down-left' : 'up-right';
}

export function TransactionCategoryIcon({
  category,
  title = '',
  credit,
  size = 18,
  color,
}: Props) {
  const tint = color ?? (credit ? Brand.success : Brand.orange);
  const glyph = glyphFor(category, title, credit);

  if (glyph === 'gift') {
    return <LucideGiftIcon size={size} color={tint} strokeWidth={STROKE} />;
  }

  return <LucideGlyph name={glyph} size={size} color={tint} />;
}

function LucideGlyph({
  name,
  size,
  color,
}: {
  name: Exclude<Glyph, 'gift'>;
  size: number;
  color: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: STROKE,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'wifi' ? (
        <>
          <Path d="M12 20h.01" {...common} />
          <Path d="M2 8.82a15 15 0 0 1 20 0" {...common} />
          <Path d="M5 12.859a10 10 0 0 1 14 0" {...common} />
          <Path d="M8.5 16.429a5 5 0 0 1 7 0" {...common} />
        </>
      ) : null}
      {name === 'smartphone' ? (
        <>
          <Rect x={5} y={2} width={14} height={20} rx={2} ry={2} {...common} />
          <Path d="M12 18h.01" {...common} />
        </>
      ) : null}
      {name === 'zap' ? (
        <Path
          d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
          {...common}
        />
      ) : null}
      {name === 'trending' ? (
        <>
          <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" {...common} />
          <Polyline points="16 7 22 7 22 13" {...common} />
        </>
      ) : null}
      {name === 'trophy' ? (
        <>
          <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" {...common} />
          <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" {...common} />
          <Path d="M4 22h16" {...common} />
          <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" {...common} />
          <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" {...common} />
          <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" {...common} />
        </>
      ) : null}
      {name === 'phone' ? (
        <Path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
          {...common}
        />
      ) : null}
      {name === 'percent' ? (
        <>
          <Line x1={19} y1={5} x2={5} y2={19} {...common} />
          <Circle cx={6.5} cy={6.5} r={2.5} {...common} />
          <Circle cx={17.5} cy={17.5} r={2.5} {...common} />
        </>
      ) : null}
      {name === 'store' ? (
        <>
          <Path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" {...common} />
          <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" {...common} />
          <Path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" {...common} />
          <Path d="M2 7h20" {...common} />
          <Path
            d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"
            {...common}
          />
        </>
      ) : null}
      {name === 'down-left' ? (
        <>
          <Path d="M17 7 7 17" {...common} />
          <Path d="M17 17H7V7" {...common} />
        </>
      ) : null}
      {name === 'up-right' ? (
        <>
          <Path d="M7 17 17 7" {...common} />
          <Path d="M7 7h10v10" {...common} />
        </>
      ) : null}
    </Svg>
  );
}
