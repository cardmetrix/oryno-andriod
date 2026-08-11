import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PageHeader } from '@/components/app/page-header';
import { PickerSheet } from '@/components/app/picker-sheet';
import { Screen } from '@/components/ui/screen';
import { Brand, Radius, type ThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { alert } from '@/lib/alert';
import { api } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { isCrispConfigured, openLiveChat, SUPPORT_EMAIL } from '@/lib/support';
import { SUPPORT_FAQS, SUPPORT_PHONE, SUPPORT_TOPICS } from '@/lib/support-config';

type TicketRow = {
  id: string;
  reference: string;
  subject: string;
  status: string;
  updatedAt: string;
};

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60_000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function SupportScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useUser();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);
  const [ticketRef, setTicketRef] = useState('');
  const [topic, setTopic] = useState<(typeof SUPPORT_TOPICS)[number]>(SUPPORT_TOPICS[0]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  useEffect(() => {
    const fromClerk = user?.primaryEmailAddress?.emailAddress;
    if (fromClerk) setEmail(fromClerk);
  }, [user?.primaryEmailAddress?.emailAddress]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await api.get<{ tickets?: TicketRow[] }>(endpoints.support.tickets);
        if (!cancelled) setTickets(json.tickets ?? []);
      } catch {
        if (!cancelled) setTickets([]);
      } finally {
        if (!cancelled) setLoadingTickets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openChat() {
    const opened = await openLiveChat();
    if (!opened) {
      setTicketOpen(true);
      setTopic('Other');
    }
  }

  async function submitTicket() {
    if (!message.trim()) {
      alert.warning('Missing message', 'Describe how we can help.');
      return;
    }
    if (!email.trim()) {
      alert.warning('Missing email', 'Add an email so we can update you.');
      return;
    }
    setSubmitting(true);
    try {
      const json = await api.post<{ ticket?: { reference: string } }>(
        endpoints.support.tickets,
        { topic, email, message: message.trim() },
      );
      const ref = json.ticket?.reference || 'ORY';
      setTicketRef(ref);
      setTicketSent(true);
      setTicketOpen(false);
      setMessage('');
      setTickets((prev) => [
        {
          id: ref,
          reference: ref,
          subject: `${topic} — ${message.trim().slice(0, 72)}`,
          status: 'open',
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (e) {
      alert.error('Error', e instanceof Error ? e.message : 'Could not contact support');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <PageHeader
        title="Help & Support"
        subtitle="Live chat, tickets, and FAQs"
        showBack
      />

      <Animated.View entering={FadeInDown.duration(280)} style={styles.heroWrap}>
        <LinearGradient
          colors={[Brand.orange, Brand.orangeSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="headset-outline" size={24} color={Brand.white} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroEyebrow}>ORYNO Support</Text>
              <Text style={styles.heroTitle}>We’re here to help</Text>
              <Text style={styles.heroSub}>
                Live chat with an agent, or open a ticket and we’ll email you.
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.92 }]}
            onPress={() => void openChat()}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#111" />
            <Text style={styles.heroCtaText}>Start Live Chat</Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(40).duration(280)} style={styles.actions}>
        <ActionCard
          icon="chatbubble-ellipses-outline"
          title="Live Chat"
          subtitle={isCrispConfigured() ? 'Chat with an agent' : 'Opens a ticket'}
          onPress={() => void openChat()}
        />
        <ActionCard
          icon="ticket-outline"
          title="New Ticket"
          subtitle="Trackable support request"
          onPress={() => {
            setTicketOpen(true);
            setTicketSent(false);
          }}
        />
        <ActionCard
          icon="mail-outline"
          title="Email us"
          subtitle={SUPPORT_EMAIL}
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
      </Animated.View>

      {ticketSent ? (
        <Animated.View entering={FadeInDown.duration(240)} style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={22} color={Brand.success} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.successTitle}>Ticket submitted</Text>
            <Text style={styles.successSub}>
              Reference <Text style={styles.successRef}>{ticketRef}</Text> — we’ll update you by
              email.
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.panel}>
        <View style={styles.ticketsHeader}>
          <Text style={styles.panelTitle}>Your tickets</Text>
          <Text style={styles.ticketsMeta}>Last 30 days</Text>
        </View>
        <View style={styles.ticketList}>
          {loadingTickets ? (
            <Text style={styles.ticketMeta}>Loading tickets…</Text>
          ) : tickets.length === 0 ? (
            <Text style={styles.ticketMeta}>No tickets yet. Open one above or start live chat.</Text>
          ) : (
            tickets.map((ticket) => {
              const resolved = ticket.status === 'resolved' || ticket.status === 'closed';
              return (
                <View key={ticket.id} style={styles.ticketRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    <Text style={styles.ticketMeta}>
                      {ticket.reference} · {timeAgo(ticket.updatedAt)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      resolved ? styles.statusResolved : styles.statusProgress,
                    ]}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={resolved ? Brand.success : Brand.orange}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: resolved ? Brand.success : Brand.orange },
                      ]}>
                      {statusLabel(ticket.status)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(280)} style={styles.panel}>
        <Text style={styles.panelTitle}>Frequently asked questions</Text>
        <Text style={[styles.panelSub, { marginBottom: 10 }]}>
          Quick answers for common ORYNO questions
        </Text>
        <View style={styles.faqList}>
          {SUPPORT_FAQS.map((faq, index) => {
            const open = openFaq === index;
            return (
              <View
                key={faq.q}
                style={[styles.faqItem, index < SUPPORT_FAQS.length - 1 && styles.faqBorder]}>
                <Pressable
                  style={styles.faqRow}
                  onPress={() => setOpenFaq(open ? null : index)}>
                  <Text style={styles.faqQ}>{faq.q}</Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={open ? Brand.orange : colors.grayMedium}
                    style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
                  />
                </Pressable>
                {open ? <Text style={styles.faqA}>{faq.a}</Text> : null}
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(280)} style={styles.callCard}>
        <View style={styles.callLeft}>
          <View style={styles.callIcon}>
            <Ionicons name="call-outline" size={20} color={Brand.orange} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.callTitle}>Still need help?</Text>
            <Text style={styles.callSub}>
              {SUPPORT_PHONE
                ? `Call ${SUPPORT_PHONE} · or email ${SUPPORT_EMAIL}`
                : `Email ${SUPPORT_EMAIL} and we’ll get back to you.`}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.9 }]}
          onPress={() =>
            void Linking.openURL(
              SUPPORT_PHONE ? `tel:${SUPPORT_PHONE}` : `mailto:${SUPPORT_EMAIL}`,
            )
          }>
          <Text style={styles.callBtnText}>{SUPPORT_PHONE ? 'Call support' : 'Email support'}</Text>
        </Pressable>
      </Animated.View>

      <PickerSheet
        visible={ticketOpen}
        title="New ticket"
        subtitle="We’ll email updates as we resolve it"
        onClose={() => setTicketOpen(false)}>
        <Text style={styles.fieldLabel}>Topic</Text>
        <View style={styles.topicChips}>
          {SUPPORT_TOPICS.map((item) => {
            const active = topic === item;
            return (
              <Pressable
                key={item}
                onPress={() => setTopic(item)}
                style={[styles.topicChip, active && styles.topicChipActive]}>
                <Text style={[styles.topicChipText, active && styles.topicChipTextActive]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@email.com"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
        />

        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>How can we help?</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder="Describe the issue, including transaction IDs if you have them…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, styles.textarea]}
        />

        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            submitting && { opacity: 0.65 },
            pressed && !submitting && { opacity: 0.92 },
          ]}
          disabled={submitting}
          onPress={() => void submitTicket()}>
          {submitting ? <ActivityIndicator color={Brand.white} /> : null}
          <Text style={styles.submitText}>Submit ticket</Text>
        </Pressable>
      </PickerSheet>
    </Screen>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
      onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={Brand.orange} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  heroWrap: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: Brand.orange,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  hero: { padding: 14, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute',
    top: -48,
    right: -24,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  heroTitle: {
    marginTop: 4,
    color: Brand.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  heroCta: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: Brand.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroCtaText: { color: '#111', fontSize: 14, fontWeight: '800' },
  actions: { gap: 10, marginBottom: 12 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
  },
  actionCardPressed: {
    borderColor: 'rgba(255,106,0,0.45)',
    backgroundColor: colors.orangeMuted,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  actionSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  panel: {
    marginBottom: 12,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  panelTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  panelSub: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  panelAction: { fontSize: 13, fontWeight: '700', color: Brand.orange },
  chatBox: {
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 10,
  },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  bubbleAgent: {
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleUser: {
    backgroundColor: Brand.orange,
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.foreground,
    fontWeight: '500',
  },
  bubbleTextUser: { color: Brand.white },
  chatComposer: { marginTop: 10, flexDirection: 'row', gap: 8 },
  chatInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.foreground,
  },
  sendBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: Brand.orange,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: Brand.white, fontSize: 14, fontWeight: '800' },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
  },
  topicChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    borderRadius: 999,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicChipActive: {
    backgroundColor: Brand.orange,
    borderColor: Brand.orange,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
  },
  topicChipTextActive: { color: Brand.white },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.foreground,
  },
  textarea: {
    height: 110,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: Brand.orange,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  successCard: {
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  successIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  successSub: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  successRef: { color: Brand.orange, fontWeight: '800' },
  ticketsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ticketsMeta: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  ticketList: { gap: 10 },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ticketSubject: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  ticketMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusResolved: { backgroundColor: colors.muted },
  statusProgress: { backgroundColor: colors.orangeMuted },
  statusText: { fontSize: 11, fontWeight: '700' },
  faqList: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  faqItem: { paddingHorizontal: 12 },
  faqBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.foreground },
  faqA: {
    paddingBottom: 12,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  callCard: {
    marginBottom: 8,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  callLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  callIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  callSub: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  callBtn: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.45)',
    backgroundColor: colors.orangeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnText: { fontSize: 14, fontWeight: '800', color: Brand.orange },
});
}

