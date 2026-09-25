export const SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@orynoafrica.com';

export const SUPPORT_PHONE = process.env.EXPO_PUBLIC_SUPPORT_PHONE?.trim() || '';

export const USD_CARD_ISSUER = 'Maplerad';

/** Ticket topics aligned to live ORYNO services. */
export const SUPPORT_TOPICS = [
  'Wallet & Funding',
  'Airtime',
  'Data Bundles',
  'Electricity',
  'TV Bills',
  'Betting',
  'Social Boost',
  'Virtual Numbers',
  'Gift Cards',
  'Invoices',
  'USD Virtual Card',
  'Account & Security',
  'Other',
] as const;

/** FAQs for services ORYNO currently offers. */
export const SUPPORT_FAQS = [
  {
    q: 'How do I fund my ORYNO wallet?',
    a: 'Open Fund from the dashboard, then pay with card, bank transfer, or your dedicated virtual account. Successful payments usually credit your local wallet within seconds. Use Convert to move money between local and USD wallets.',
  },
  {
    q: 'How do I buy airtime?',
    a: 'Go to Services → Airtime, pick your network, enter the phone number and amount, then pay from your wallet. Top-ups are usually instant; if a network is slow, the order stays in Processing until it completes or fails with an automatic refund.',
  },
  {
    q: 'How do data bundles work?',
    a: 'Open Services → Data, choose a network and plan, confirm the number, and pay from your wallet. Delivery is typically instant once the provider confirms the order.',
  },
  {
    q: 'How do I pay electricity bills?',
    a: 'Go to Services → Electricity, select your disco, enter and verify your meter number, then pay from your wallet. Prepaid tokens show in the order receipt and History after a successful payment.',
  },
  {
    q: 'How do I pay TV bills (DStv, GOtv, StarTimes)?',
    a: 'Open Services → TV Bills, choose your provider, enter your smartcard or IUC number, pick a bouquet or amount, and pay from your wallet.',
  },
  {
    q: 'How do I fund a betting account?',
    a: 'Go to Services → Betting, select your bookmaker, enter and verify the customer ID, then fund from your wallet. Credits are typically instant once the provider confirms.',
  },
  {
    q: 'How does Social Boost work?',
    a: 'Open Services → Social Boost, pick a platform and package, paste your profile or post link, and pay from your wallet. Track the order in History.',
  },
  {
    q: 'How do virtual numbers work?',
    a: 'Go to Services → Virtual Numbers, choose a country and service, then buy a number with your wallet. SMS codes appear on the order screen while the number is active.',
  },
  {
    q: 'How do I buy gift cards?',
    a: 'Open Services → Gift Cards, pick a brand and amount, and pay with your USD wallet balance. Codes are delivered in the order receipt and History after a successful purchase.',
  },
  {
    q: 'How do invoices work?',
    a: 'Open Services → Invoices to create an invoice with line items and download a PDF. Payment links are available from the same flow when you only need a checkout link.',
  },
  {
    q: 'How do USD virtual cards work?',
    a: `Open Cards to issue a ${USD_CARD_ISSUER} Visa card that spends from your USD wallet. Reveal the PAN and CVV with your transaction PIN, and freeze the card anytime.`,
  },
] as const;
