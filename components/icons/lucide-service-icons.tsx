import Svg, { Path, Polyline, Rect } from 'react-native-svg';

import { LucideGiftIcon } from '@/components/icons/lucide-gift-icon';

type Props = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const common = (color: string, strokeWidth: number) => ({
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
});

/** Lucide Smartphone */
export function SmartphoneIcon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={2} width={14} height={20} rx={2} ry={2} {...stroke} />
      <Path d="M12 18h.01" {...stroke} />
    </Svg>
  );
}

/** Lucide Wifi */
export function WifiIcon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20h.01" {...stroke} />
      <Path d="M2 8.82a15 15 0 0 1 20 0" {...stroke} />
      <Path d="M5 12.859a10 10 0 0 1 14 0" {...stroke} />
      <Path d="M8.5 16.429a5 5 0 0 1 7 0" {...stroke} />
    </Svg>
  );
}

/** Lucide Zap */
export function ZapIcon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
        {...stroke}
      />
    </Svg>
  );
}

/** Lucide Tv */
export function TvIcon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect width={20} height={15} x={2} y={7} rx={2} ry={2} {...stroke} />
      <Polyline points="17 2 12 7 7 2" {...stroke} />
    </Svg>
  );
}

/** Lucide Trophy */
export function TrophyIcon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" {...stroke} />
      <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" {...stroke} />
      <Path d="M4 22h16" {...stroke} />
      <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" {...stroke} />
      <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" {...stroke} />
      <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" {...stroke} />
    </Svg>
  );
}

/** Lucide TrendingUp */
export function TrendingUpIcon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" {...stroke} />
      <Polyline points="16 7 22 7 22 13" {...stroke} />
    </Svg>
  );
}

/** Lucide Phone */
export function PhoneIcon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        {...stroke}
      />
    </Svg>
  );
}

/** Lucide Activity */
export function ActivityIcon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 12h-4l-3 9L9 3l-3 9H2" {...stroke} />
    </Svg>
  );
}

/** Lucide FileText */
export function FileTextIcon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" {...stroke} />
      <Path d="M14 2v4a2 2 0 0 0 2 2h4" {...stroke} />
      <Path d="M10 9H8" {...stroke} />
      <Path d="M16 13H8" {...stroke} />
      <Path d="M16 17H8" {...stroke} />
    </Svg>
  );
}

/** Lucide Link2 */
export function Link2Icon({ size = 24, color = '#fff', strokeWidth = 1.75 }: Props) {
  const stroke = common(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 17H7A5 5 0 0 1 7 7h2" {...stroke} />
      <Path d="M15 7h2a5 5 0 1 1 0 10h-2" {...stroke} />
      <Path d="M8 12h8" {...stroke} />
    </Svg>
  );
}

export function GiftServiceIcon({ strokeWidth = 1.75, ...props }: Props) {
  return <LucideGiftIcon strokeWidth={strokeWidth} {...props} />;
}
