export interface Region {
  id: string;
  flag: string;
  name: string;
  code: string;
  currencySymbol: string;
  costPerMin: number;
  pricePerConvo: number;
}

export const REGIONS: Region[] = [
  { id: 'in', flag: '🇮🇳', name: 'India', code: '+91', currencySymbol: '$', costPerMin: 0.5, pricePerConvo: 0.045 },
  { id: 'gcc', flag: '🇦🇪', name: 'GCC', code: '+971', currencySymbol: 'AED ', costPerMin: 1.2, pricePerConvo: 0.2 },
  { id: 'us', flag: '🇺🇸', name: 'USA', code: '+1', currencySymbol: '$', costPerMin: 0.5, pricePerConvo: 0.15 },
];

export interface Channel {
  id: string;
  name: string;
  sub: string;
}

export const CHANNELS: Channel[] = [
  { id: 'call', name: 'Phone call', sub: 'Inbound support line' },
  { id: 'chat', name: 'Web chat', sub: 'Site widget' },
  { id: 'wa', name: 'WhatsApp', sub: 'Business messaging' },
  { id: 'email', name: 'Email', sub: 'Shared inbox' },
  { id: 'gpt', name: 'ChatGPT & assistants', sub: 'Via API or MCP' },
];

export interface DeploymentChannel {
  id: string;
  name: string;
  sub: string;
  heading: string;
  copy: string;
  bullets: string[];
  plan: string;
}

export const DEPLOYMENT_CHANNELS: DeploymentChannel[] = [
  {
    id: 'widget',
    name: 'On your website',
    sub: 'One script tag',
    heading: 'A launcher on every page',
    copy: 'Add one line to your site and the launcher appears bottom-right — call, WhatsApp and chat, in your colours. It reads the page the customer is on, so it already knows what they are looking at.',
    bullets: [
      'Loads asynchronously; no effect on page speed',
      'Inherits your brand colour and voice',
      'Falls back to a callback form outside business hours',
      'Works on any stack — WordPress, Shopify, custom',
    ],
    plan: 'Included from Starter',
  },
  {
    id: 'hosted',
    name: 'No website? Use ours',
    sub: 'yourbrand.aidouble.site',
    heading: 'A whole site that is just talk',
    copy: 'If you have no website, the Double becomes one. You get a subdomain where the entire page is the conversation — call it, chat with it, or scan the QR from a poster or a menu card.',
    bullets: [
      'Live in minutes, no hosting or developer',
      'Custom domain when you are ready',
      'QR code for print, packaging and table cards',
      'Indexed by search engines',
    ],
    plan: 'Included from Starter',
  },
  {
    id: 'apps',
    name: 'Apps & GPT stores',
    sub: 'Branded, published for you',
    heading: 'Published under your name',
    copy: 'We wrap the same agent as a branded mobile app and submit it to the stores, and publish a connector so customers can reach you from inside their own assistant.',
    bullets: [
      'iOS and Android, your icon and name',
      'Store submission and review handled',
      'GPT store listing and MCP connector',
      'Push notifications for renewals and reminders',
    ],
    plan: 'Included from Pro',
  },
  {
    id: 'directory',
    name: 'Promoted in AI Double',
    sub: 'Customer-side discovery',
    heading: 'Found by people already asking',
    copy: "Customers use AI Double for their own admin. When theirs needs an insurer, a clinic or a restaurant, subscribed businesses are the ones it can reach — with your agent answering, not a listing.",
    bullets: [
      'Listed by industry, city and language',
      'Your agent answers the enquiry directly',
      'Verified badge once licence checks pass',
      'Pay only for conversations that connect',
    ],
    plan: 'Included from Pro',
  },
];

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface Plan {
  id: string;
  name: string;
  priceByRegion: Record<string, number | null>;
  conversations: number;
  minutes: number;
  overageByRegion: Record<string, number>;
  hot?: boolean;
  features: PlanFeature[];
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceByRegion: { in: 199, gcc: 10, us: 199 },
    conversations: 250,
    minutes: 300,
    overageByRegion: { in: 1.99, gcc: 0.1, us: 1.99 },
    features: [
      { label: 'One industry agent', included: true },
      { label: 'Website widget', included: true },
      { label: 'Hosted subdomain', included: true },
      { label: 'Voice + chat', included: true },
      { label: 'WhatsApp', included: false },
      { label: 'App & GPT stores', included: false },
      { label: 'Directory promotion', included: false },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    priceByRegion: { in: 299, gcc: 25, us: 299 },
    conversations: 750,
    minutes: 900,
    overageByRegion: { in: 1, gcc: 0.08, us: 1 },
    hot: true,
    features: [
      { label: 'Three industry agents', included: true },
      { label: 'Website widget', included: true },
      { label: 'Hosted subdomain', included: true },
      { label: 'Voice + chat', included: true },
      { label: 'WhatsApp & email', included: true },
      { label: 'App & GPT stores', included: false },
      { label: 'Directory promotion', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceByRegion: { in: 499, gcc: 50, us: 499 },
    conversations: 2000,
    minutes: 2400,
    overageByRegion: { in: 0.62, gcc: 0.05, us: 0.62 },
    features: [
      { label: 'Unlimited agents', included: true },
      { label: 'Website widget', included: true },
      { label: 'Hosted subdomain', included: true },
      { label: 'Voice + chat', included: true },
      { label: 'WhatsApp & email', included: true },
      { label: 'Branded app & GPT stores', included: true },
      { label: 'Directory promotion', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceByRegion: { in: null, gcc: null, us: null },
    conversations: 0,
    minutes: 0,
    overageByRegion: { in: 0.37, gcc: 0.03, us: 0.37 },
    features: [
      { label: 'Everything in Pro', included: true },
      { label: 'In-region or on-prem', included: true },
      { label: 'SSO, DPA, retention controls', included: true },
      { label: 'CRM & telephony integration', included: true },
      { label: 'Committed volume pricing', included: true },
      { label: 'Named solutions engineer', included: true },
      { label: 'Custom SLA', included: true },
    ],
  },
];
