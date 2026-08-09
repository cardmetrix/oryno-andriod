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

const faqs = [
  {
    q: 'How do I fund my ORYNO wallet?',
    a: 'Go to Wallet → Fund, choose card, bank transfer, or USSD, enter an amount, and confirm. Funds usually appear within seconds after a successful payment.',
  },
  {
    q: 'Why is my airtime or data purchase delayed?',
    a: 'Most top-ups are instant. If a network is slow, your order stays in Processing and you’ll get a notification when it completes or fails with an automatic wallet refund.',
  },
  {
    q: 'How do withdrawals work?',
    a: 'Withdraw from Wallet → Withdraw. ORYNO detects your country and routes payouts through the correct local bank or mobile money provider. Typical timing is 5–30 minutes.',
  },
  {
    q: 'When will gift cards launch?',
    a: 'Gift card buy & sell is coming soon. Tap Notify me on the Gift Cards screen to get an alert when it goes live in your country.',
  },
  {
    q: 'How do I verify my account (KYC)?',
    a: 'Open Settings → KYC Verification and follow the steps. Some features may require KYC depending on your country configuration and transaction limits.',
  },
];

const tickets = [
  {
    id: 'ORY-1042',
    subject: 'Data bundle not activated',
    status: 'In progress',
    updated: '2 hrs ago',
  },
  {
    id: 'ORY-0988',
    subject: 'Wallet funding confirmation',
    status: 'Resolved',
    updated: 'Yesterday',
  },
];

const topics = [
  'Wallet & Funding',
  'Airtime / Data',
  'Bill Payments',
  'Virtual Numbers',
  'Rent Email',
  'Account & Security',
  'Other',
];

export default function SupportScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useUser();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);
  const [ticketRef, setTicketRef] = useState('ORY-1107');
  const [topic, setTopic] = useState(topics[0]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fromClerk = user?.primaryEmailAddress?.emailAddress;
    if (fromClerk) setEmail(fromClerk);
  }, [user?.primaryEmailAddress?.emailAddress]);

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
      await api.post(endpoints.support.errorReport, {
        errorMessage: `[${topic}]\n\n${message.trim()}`,
        page: 'mobile-support',
        userNote: topic,
        url: 'oryno-africa://support',
      });
      const ref = `ORY-${1100 + Math.floor(Math.random() * 80)}`;
      setTicketRef(ref);
      setTicketSent(true);
      setTicketOpen(false);
      setMessage('');
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
                Average reply under 10 minutes · 24/7 for urgent wallet issues
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.92 }]}
            onPress={() => {
              setChatOpen(true);
              setTicketOpen(false);
            }}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#111" />
            <Text style={styles.heroCtaText}>Start Live Chat</Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(40).duration(280)} style={styles.actions}>
        <ActionCard
          icon="chatbubble-ellipses-outline"
          title="Live Chat"
          subtitle="Chat with an agent"
          onPress={() => {
            setChatOpen(true);
            setTicketOpen(false);
          }}
        />
        <ActionCard
          icon="ticket-outline"
          title="New Ticket"
          subtitle="Trackable support request"
          onPress={() => {
            setTicketOpen(true);
            setChatOpen(false);
            setTicketSent(false);
          }}
        />
        <ActionCard
          icon="mail-outline"
          title="Email us"
          subtitle="support@oryno.com"
          onPress={() => void Linking.openURL('mailto:support@oryno.com')}
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
          {tickets.map((ticket) => {
            const resolved = ticket.status === 'Resolved';
            return (
              <View key={ticket.id} style={styles.ticketRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.ticketSubject} numberOfLines={1}>
                    {ticket.subject}
                  </Text>
                  <Text style={styles.ticketMeta}>
                    {ticket.id} · Updated {ticket.updated}
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
                    {ticket.status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(280)} style={styles.panel}>
        <Text style={styles.panelTitle}>Frequently asked questions</Text>
        <Text style={[styles.panelSub, { marginBottom: 10 }]}>
          Quick answers for common ORYNO questions
        </Text>
        <View style={styles.faqList}>
          {faqs.map((faq, index) => {
            const open = openFaq === index;
            return (
              <View
                key={faq.q}
                style={[styles.faqItem, index < faqs.length - 1 && styles.faqBorder]}>
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
            <Text style={styles.callSub}>Call +234 800 000 ORYNO · Mon–Sun, 8am–10pm</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.9 }]}
          onPress={() => void Linking.openURL('tel:+2348000000000')}>
          <Text style={styles.callBtnText}>Call support</Text>
        </Pressable>
      </Animated.View>

      <PickerSheet
        visible={chatOpen}
        title="Live chat"
        subtitle="Agent typically joins in under a minute"
        onClose={() => setChatOpen(false)}>
        <View style={styles.chatBox}>
          <ChatBubble
            from="agent"
            text="Hi 👋 Welcome to ORYNO Support. How can we help today?"
          />
          <ChatBubble from="user" text="I need help confirming a wallet funding." />
          <ChatBubble
            from="agent"
            text="Sure — share the amount and approximate time, and we’ll check it right away."
          />
        </View>
        <View style={styles.chatComposer}>
          <TextInput
            value={chatDraft}
            onChangeText={setChatDraft}
            placeholder="Type your message…"
            placeholderTextColor={colors.mutedForeground}
            style={styles.chatInput}
          />
          <Pressable
            style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.9 }]}
            onPress={() => {
              if (!chatDraft.trim()) return;
              alert.info(
                'Message queued',
                'Live agents aren’t connected in this build yet. Open a ticket and we’ll follow up by email.',
              );
              setChatDraft('');
              setChatOpen(false);
              setTicketOpen(true);
            }}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </PickerSheet>

      <PickerSheet
        visible={ticketOpen}
        title="New ticket"
        subtitle="We’ll email updates as we resolve it"
        onClose={() => setTicketOpen(false)}>
        <Text style={styles.fieldLabel}>Topic</Text>
        <View style={styles.topicChips}>
          {topics.map((item) => {
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

function ChatBubble({ from, text }: { from: 'agent' | 'user'; text: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isUser = from === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{text}</Text>
      </View>
    </View>
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

