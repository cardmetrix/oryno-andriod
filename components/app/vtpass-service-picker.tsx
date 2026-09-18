import { SelectSheet, type PickerOption } from '@/components/app/picker-sheet';

export type VtpassServiceOption = {
  serviceID: string;
  name: string;
  image?: string | null;
  domain?: string | null;
  imageFallbacks?: string[] | null;
  minAmount?: number;
  maxAmount?: number;
  customerLabel?: string;
};

type Props = {
  services: VtpassServiceOption[];
  value: string;
  onChange: (serviceID: string) => void;
  loading?: boolean;
  label?: string;
  title?: string;
  subtitle?: string;
};

/** Network / provider picker that opens a notifications-style bottom sheet. */
export function VtpassServicePicker({
  services,
  value,
  onChange,
  loading,
  label = 'Network',
  title = 'Select network',
  subtitle = 'Choose a provider',
}: Props) {
  const options: PickerOption[] = services.map((s) => ({
    id: s.serviceID,
    title: s.name,
    subtitle: value === s.serviceID ? 'Selected' : 'Tap to select',
    // Always pass image (null → letter fallback) so logos show in the sheet.
    image: s.image ?? null,
    domain: s.domain,
    imageFallbacks: s.imageFallbacks,
  }));

  return (
    <SelectSheet
      label={label}
      title={title}
      subtitle={subtitle}
      hint="Tap to choose network"
      options={options}
      value={value}
      onChange={onChange}
      loading={loading}
      emptyText="No networks available"
    />
  );
}
