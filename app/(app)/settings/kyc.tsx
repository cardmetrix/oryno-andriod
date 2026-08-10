import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FormSkeleton } from '@/components/ui/skeletons';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import {
  getLevelDef,
  nextKycLevel,
  normalizeKycLevel,
  type AccountLevelId,
} from '@/lib/account-levels';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { toast } from '@/lib/toast';

const MAX_IMAGE_BYTES = 6_000_000;

type KycImage = {
  filename: string;
  mime: string;
  base64: string;
  preview: string;
};

type Submission = {
  id: string;
  step: number;
  targetLevel?: number;
  idType: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  status: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  createdAt: string | null;
};

type KycResponse = {
  kycStatus: string;
  kycLevel?: number;
  nextLevel?: number | null;
  message?: string;
  submission: Submission | null;
};

const REVIEW_STEPS = [
  {
    key: 'submitted',
    label: 'Documents submitted',
    detail: 'ID and selfie received securely',
  },
  {
    key: 'review',
    label: 'Under review',
    detail: 'Our team is verifying your identity',
  },
  {
    key: 'done',
    label: 'Verification complete',
    detail: 'You’ll get a notification when approved',
  },
] as const;

function formatSubmittedAt(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-NG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function pickKycImage(): Promise<KycImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    toast.error('Allow photo library access to upload KYC documents.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const base64 = asset.base64;
  if (!base64) {
    toast.error('Could not read that image. Try another photo.');
    return null;
  }

  const approxBytes = Math.ceil((base64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    toast.error('Each image must be under 6MB');
    return null;
  }

  return {
    filename: asset.fileName || `kyc-${Date.now()}.jpg`,
    mime: asset.mimeType || 'image/jpeg',
    base64,
    preview: asset.uri,
  };
}

export default function KycScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState('unverified');
  const [kycLevel, setKycLevel] = useState(0);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [idType, setIdType] = useState('NIN');
  const [idNumber, setIdNumber] = useState('');
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [idFrontImage, setIdFrontImage] = useState<KycImage | null>(null);
  const [idBackImage, setIdBackImage] = useState<KycImage | null>(null);
  const [selfieImage, setSelfieImage] = useState<KycImage | null>(null);
  const [picking, setPicking] = useState<'front' | 'back' | 'selfie' | null>(null);

  const frontPreview = idFrontImage?.preview || idFrontUrl;
  const backPreview = idBackImage?.preview || idBackUrl;
  const selfiePreview = selfieImage?.preview || selfieUrl;

  const targetLevel = useMemo(() => {
    const next = nextKycLevel(kycLevel);
    if (kycStatus === 'pending' && submission?.targetLevel) {
      return normalizeKycLevel(submission.targetLevel) || next || 1;
    }
    return next;
  }, [kycLevel, kycStatus, submission?.targetLevel]);

  const levelDef = targetLevel
    ? getLevelDef(targetLevel as AccountLevelId)
    : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<KycResponse>(endpoints.settings.kyc);
      const level = normalizeKycLevel(json.kycLevel);
      setKycStatus(json.kycStatus || 'unverified');
      setKycLevel(level);
      setSubmission(json.submission);

      const next = nextKycLevel(level);
      const subLevel =
        normalizeKycLevel(json.submission?.targetLevel) || next || 1;
      const def = getLevelDef(
        (json.kycStatus === 'pending' ? subLevel : next || 1) as AccountLevelId,
      );
      const types = def?.kyc.idTypes ?? ['NIN'];

      if (json.submission && json.kycStatus === 'pending') {
        const match = types.find(
          (t) =>
            t.toLowerCase() === (json.submission!.idType || '').toLowerCase(),
        );
        setIdType(match || types[0]);
        setIdNumber(json.submission.idNumber || '');
        setIdFrontUrl(json.submission.idFrontUrl);
        setIdBackUrl(json.submission.idBackUrl);
        setSelfieUrl(json.submission.selfieUrl);
      } else if (def) {
        setIdType(types[0]);
        setIdNumber('');
        setIdFrontUrl(null);
        setIdBackUrl(null);
        setSelfieUrl(null);
        setIdFrontImage(null);
        setIdBackImage(null);
        setSelfieImage(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load KYC');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPick(target: 'front' | 'back' | 'selfie') {
    setPicking(target);
    try {
      const image = await pickKycImage();
      if (!image) return;
      if (target === 'front') setIdFrontImage(image);
      if (target === 'back') setIdBackImage(image);
      if (target === 'selfie') setSelfieImage(image);
      toast.success('Document ready', { description: 'Save draft or submit when done.' });
    } finally {
      setPicking(null);
    }
  }

  async function saveProgress(submit = false) {
    if (!targetLevel || !levelDef) return;
    if (levelDef.kyc.numberRequired && !idNumber.trim()) {
      toast.error(`Enter your ${levelDef.kyc.numberLabel}`);
      return;
    }
    if (submit && levelDef.kyc.frontRequired && !frontPreview) {
      toast.error(`Upload your ${levelDef.kyc.frontLabel}`);
      return;
    }
    if (submit && levelDef.kyc.selfieRequired && !selfiePreview) {
      toast.error('Upload a selfie to submit');
      return;
    }

    setSaving(true);
    try {
      const json = await api.post<KycResponse>(endpoints.settings.kyc, {
        targetLevel,
        idType,
        idNumber: idNumber.trim(),
        idFrontUrl: idFrontUrl || undefined,
        idBackUrl: idBackUrl || undefined,
        selfieUrl: selfieUrl || undefined,
        idFrontImage: idFrontImage
          ? {
              filename: idFrontImage.filename,
              mime: idFrontImage.mime,
              base64: idFrontImage.base64,
            }
          : undefined,
        idBackImage: idBackImage
          ? {
              filename: idBackImage.filename,
              mime: idBackImage.mime,
              base64: idBackImage.base64,
            }
          : undefined,
        selfieImage: selfieImage
          ? {
              filename: selfieImage.filename,
              mime: selfieImage.mime,
              base64: selfieImage.base64,
            }
          : undefined,
        step: targetLevel,
        submit,
      });

      setKycStatus(json.kycStatus || (submit ? 'pending' : kycStatus));
      setKycLevel(normalizeKycLevel(json.kycLevel));
      setSubmission(json.submission);
      if (json.submission) {
        setIdFrontUrl(json.submission.idFrontUrl);
        setIdBackUrl(json.submission.idBackUrl);
        setSelfieUrl(json.submission.selfieUrl);
      }
      setIdFrontImage(null);
      setIdBackImage(null);
      setSelfieImage(null);
      toast.success(
        submit ? `Level ${targetLevel} submitted for review` : 'Progress saved',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save KYC');
    } finally {
      setSaving(false);
    }
  }

  const locked = kycStatus === 'pending' || kycLevel >= 3;
  const canSubmit = Boolean(
    levelDef &&
      (!levelDef.kyc.numberRequired || idNumber.trim()) &&
      (!levelDef.kyc.frontRequired || frontPreview) &&
      (!levelDef.kyc.selfieRequired || selfiePreview),
  );
  const submittedLabel = formatSubmittedAt(
    submission?.submittedAt || submission?.createdAt,
  );
  const progress = kycLevel / 3;

  if (loading) {
    return (
      <Screen>
        <PageHeader title="KYC Verification" subtitle="Unlock higher limits" showBack />
        <FormSkeleton />
      </Screen>
    );
  }

  if (error && !submission) {
    return (
      <Screen>
        <PageHeader title="KYC Verification" showBack />
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Couldn’t load KYC</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={loading} onRefresh={load}>
      <PageHeader
        title="KYC Verification"
        subtitle={
          kycLevel >= 3
            ? 'You’re fully verified (Level 3)'
            : kycStatus === 'pending'
              ? `Level ${submission?.targetLevel || targetLevel} pending review`
              : targetLevel
                ? `Upgrade to Level ${targetLevel}`
                : 'Verification'
        }
        showBack
      />

      {kycStatus === 'pending' ? (
        <PendingVerificationView
          submission={submission}
          submittedLabel={submittedLabel}
          targetLevel={submission?.targetLevel || targetLevel || 1}
        />
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>

            {kycLevel >= 3 ? (
              <StatusCard
                icon="checkmark-circle"
                title="Level 3 · Fully verified"
                body="Unlimited daily limit unlocked with proof of address."
                tone="success"
              />
            ) : kycStatus === 'rejected' ? (
              <StatusCard
                icon="shield"
                title="Rejected"
                body={
                  submission?.rejectionReason ||
                  'Please update your documents and resubmit.'
                }
                tone="error"
              />
            ) : kycLevel > 0 ? (
              <StatusCard
                icon="checkmark-circle"
                title={`Level ${kycLevel} approved`}
                body={
                  levelDef
                    ? `Next: ${levelDef.requirement} for Level ${targetLevel}.`
                    : 'Upgrade further to raise your limits.'
                }
                tone="success"
              />
            ) : (
              <Text style={styles.hint}>
                {levelDef?.kyc.helpText ||
                  'Complete identity verification to unlock higher wallet limits.'}
              </Text>
            )}
          </Animated.View>

          {!locked && levelDef && targetLevel ? (
            <Animated.View
              entering={FadeInDown.delay(60).duration(280)}
              style={[styles.card, { marginTop: 10 }]}>
              <Text style={styles.section}>
                Level {targetLevel} · {levelDef.shortName}
              </Text>
              <Text style={[styles.hint, { marginBottom: 12 }]}>
                {levelDef.kyc.helpText}
              </Text>

              <Text style={styles.section}>Document type</Text>
              <View style={styles.chips}>
                {levelDef.kyc.idTypes.map((type) => {
                  const active = idType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setIdType(type)}
                      style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {type}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {levelDef.kyc.numberRequired || targetLevel === 3 ? (
                <TextField
                  label={levelDef.kyc.numberLabel}
                  value={idNumber}
                  onChangeText={setIdNumber}
                  placeholder={levelDef.kyc.numberPlaceholder}
                  keyboardType={targetLevel === 2 ? 'number-pad' : 'default'}
                  maxLength={targetLevel === 2 ? 11 : undefined}
                  autoCapitalize="characters"
                />
              ) : null}

              <View style={styles.uploadStack}>
                {levelDef.kyc.frontRequired ||
                levelDef.kyc.frontLabel.toLowerCase().includes('optional') ? (
                  <UploadTile
                    label={levelDef.kyc.frontLabel}
                    preview={frontPreview}
                    uploading={picking === 'front'}
                    onPress={() => void onPick('front')}
                  />
                ) : null}
                {levelDef.kyc.backLabel ? (
                  <UploadTile
                    label={levelDef.kyc.backLabel}
                    preview={backPreview}
                    uploading={picking === 'back'}
                    onPress={() => void onPick('back')}
                  />
                ) : null}
                {levelDef.kyc.selfieRequired ? (
                  <UploadTile
                    label="Selfie"
                    preview={selfiePreview}
                    uploading={picking === 'selfie'}
                    onPress={() => void onPick('selfie')}
                    selfie
                  />
                ) : null}
              </View>

              <View style={styles.actions}>
                <Button
                  title="Save draft"
                  variant="secondary"
                  loading={saving}
                  disabled={Boolean(picking)}
                  onPress={() => void saveProgress(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title={`Submit Level ${targetLevel}`}
                  loading={saving}
                  disabled={Boolean(picking) || !canSubmit}
                  onPress={() => void saveProgress(true)}
                  style={{ flex: 1 }}
                />
              </View>
            </Animated.View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function PendingVerificationView({
  submission,
  submittedLabel,
  targetLevel,
}: {
  submission: Submission | null;
  submittedLabel: string | null;
  targetLevel: number;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.12, { duration: 1400 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  const docs = [
    { label: 'ID front', url: submission?.idFrontUrl },
    { label: 'ID back', url: submission?.idBackUrl },
    { label: 'Selfie', url: submission?.selfieUrl },
  ].filter((d) => d.url);

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.pendingCard}>
      <LinearGradient
        colors={['#FF8124', Brand.orange, '#C94A00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pendingHero}>
        <View style={styles.pendingIconWrap}>
          <Animated.View style={[styles.pendingPulse, pulseStyle]} />
          <View style={styles.pendingIcon}>
            <Ionicons name="shield-checkmark" size={30} color={Brand.white} />
          </View>
        </View>
        <Text style={styles.pendingEyebrow}>LEVEL {targetLevel} PENDING</Text>
        <Text style={styles.pendingTitle}>We’re reviewing your KYC</Text>
        <Text style={styles.pendingBody}>
          Your documents are in the review queue. You’ll get an in-app notification
          as soon as a decision is made.
        </Text>
        <View style={styles.pendingChip}>
          <Ionicons name="time-outline" size={14} color={Brand.white} />
          <Text style={styles.pendingChipText}>Usually takes a few hours</Text>
        </View>
      </LinearGradient>

      <View style={styles.pendingContent}>
        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Submitted</Text>
            <Text style={styles.metaValue}>{submittedLabel || 'Just now'}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>ID type</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {submission?.idType || '—'}
            </Text>
          </View>
        </View>

        <Text style={styles.section}>Review progress</Text>
        {REVIEW_STEPS.map((item, index) => {
          const done = index === 0;
          const active = index === 1;
          const upcoming = index === 2;
          return (
            <View key={item.key} style={styles.reviewRow}>
              <View style={styles.reviewRail}>
                <View
                  style={[
                    styles.reviewDot,
                    done && styles.reviewDotDone,
                    active && styles.reviewDotActive,
                    upcoming && styles.reviewDotUpcoming,
                  ]}>
                  {done ? (
                    <Ionicons name="checkmark" size={14} color={Brand.white} />
                  ) : active ? (
                    <View style={styles.reviewActiveOrb} />
                  ) : (
                    <Text style={styles.reviewNum}>{index + 1}</Text>
                  )}
                </View>
                {index < REVIEW_STEPS.length - 1 ? (
                  <View
                    style={[styles.reviewLine, done && styles.reviewLineDone]}
                  />
                ) : null}
              </View>
              <View style={styles.reviewCopy}>
                <Text
                  style={[
                    styles.reviewLabel,
                    upcoming && { color: colors.mutedForeground },
                  ]}>
                  {item.label}
                </Text>
                <Text style={styles.reviewDetail}>{item.detail}</Text>
              </View>
            </View>
          );
        })}

        {docs.length ? (
          <>
            <Text style={[styles.section, { marginTop: 8 }]}>Submitted documents</Text>
            <View style={styles.docGrid}>
              {docs.map((doc) => (
                <View key={doc.label} style={styles.docTile}>
                  <Image source={{ uri: doc.url! }} style={styles.docImage} contentFit="cover" />
                  <Text style={styles.docLabel} numberOfLines={1}>
                    {doc.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.notifyBox}>
          <View style={styles.notifyIcon}>
            <Ionicons name="notifications-outline" size={18} color={Brand.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifyTitle}>We’ll notify you</Text>
            <Text style={styles.notifyBody}>
              Check Notifications for the verification result. No need to resubmit
              while review is in progress.
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function StatusCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  tone: 'success' | 'error';
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const color = tone === 'success' ? Brand.success : Brand.error;
  return (
    <View style={[styles.statusCard, { backgroundColor: `${color}14` }]}>
      <Ionicons name={icon} size={22} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.statusTitle, { color }]}>{title}</Text>
        <Text style={styles.statusBody}>{body}</Text>
      </View>
    </View>
  );
}

function UploadTile({
  label,
  preview,
  uploading,
  onPress,
  selfie,
}: {
  label: string;
  preview?: string | null;
  uploading?: boolean;
  onPress: () => void;
  selfie?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      style={({ pressed }) => [styles.uploadTile, pressed && { opacity: 0.9 }]}>
      <View style={styles.uploadThumb}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.uploadImage} contentFit="cover" />
        ) : (
          <Ionicons
            name={selfie ? 'camera-outline' : 'image-outline'}
            size={22}
            color={colors.mutedForeground}
          />
        )}
        {uploading ? (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator color={Brand.white} />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.uploadLabel}>{label}</Text>
        <Text style={styles.uploadHint}>{preview ? 'Tap to replace' : 'Tap to upload'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 12,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.muted,
      overflow: 'hidden',
      marginBottom: 10,
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: Brand.orange,
    },
    hint: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    section: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: Radius.lg,
      backgroundColor: colors.muted,
    },
    chipActive: {
      backgroundColor: colors.orangeMuted,
      borderWidth: 1.5,
      borderColor: Brand.orange,
    },
    chipText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
    chipTextActive: { color: Brand.orange },
    uploadStack: { gap: 10, marginTop: 10 },
    uploadTile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.muted,
      padding: 12,
    },
    uploadThumb: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    uploadImage: { width: '100%', height: '100%' },
    uploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    uploadHint: {
      marginTop: 2,
      fontSize: 12,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderRadius: 18,
      padding: 10,
    },
    statusTitle: { fontSize: 14, fontWeight: '800' },
    statusBody: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.foreground,
      opacity: 0.8,
    },
    pendingCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    pendingHero: {
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 30,
      alignItems: 'center',
    },
    pendingIconWrap: {
      width: 72,
      height: 72,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    pendingPulse: {
      position: 'absolute',
      width: 72,
      height: 72,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    pendingIcon: {
      width: 64,
      height: 64,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingEyebrow: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.8,
    },
    pendingTitle: {
      marginTop: 8,
      color: Brand.white,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    pendingBody: {
      marginTop: 8,
      color: 'rgba(255,255,255,0.88)',
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      maxWidth: 300,
    },
    pendingChip: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.16)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    pendingChipText: { color: Brand.white, fontSize: 12, fontWeight: '700' },
    pendingContent: { padding: 12, gap: 4 },
    metaRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    metaBox: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    metaLabel: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
    metaValue: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '700',
      color: colors.foreground,
    },
    reviewRow: { flexDirection: 'row', gap: 12 },
    reviewRail: { alignItems: 'center', width: 32 },
    reviewDot: {
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reviewDotDone: { backgroundColor: Brand.success },
    reviewDotActive: {
      backgroundColor: colors.orangeMuted,
      borderWidth: 2,
      borderColor: 'rgba(255,106,0,0.35)',
    },
    reviewDotUpcoming: { backgroundColor: colors.muted },
    reviewActiveOrb: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: Brand.orange,
    },
    reviewNum: { fontSize: 12, fontWeight: '800', color: colors.mutedForeground },
    reviewLine: {
      width: 2,
      flex: 1,
      minHeight: 22,
      marginVertical: 4,
      backgroundColor: colors.border,
      borderRadius: 999,
    },
    reviewLineDone: { backgroundColor: Brand.success },
    reviewCopy: { flex: 1, paddingBottom: 12 },
    reviewLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    reviewDetail: {
      marginTop: 2,
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 17,
    },
    docGrid: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    docTile: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      backgroundColor: colors.muted,
    },
    docImage: { width: '100%', aspectRatio: 1 },
    docLabel: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontSize: 11,
      fontWeight: '600',
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    notifyBox: {
      marginTop: 8,
      flexDirection: 'row',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(255,106,0,0.28)',
      backgroundColor: colors.orangeMuted,
      padding: 10,
    },
    notifyIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifyTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    notifyBody: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.mutedForeground,
    },
    errorCard: {
      marginTop: 12,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 12,
      alignItems: 'center',
    },
    errorTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },
    errorSub: {
      marginTop: 6,
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 12,
      backgroundColor: Brand.orange,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    retryText: { color: Brand.white, fontWeight: '700', fontSize: 13 },
  });
}
