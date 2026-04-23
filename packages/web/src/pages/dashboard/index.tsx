import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  TrendingUp,
  ListChecks,
  Building2,
  Megaphone,
  Plug,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/utils';

interface DashboardStats {
  totalMessages: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesFailed: number;
  connectedPlatforms: number;
  activeCampaigns: number;
  verifiedBrands: number;
}

interface OperationsSummary {
  billing: {
    cycleMonth: string;
    smsOutbound: number;
    smsInbound: number;
    mmsOutbound: number;
    mmsInbound: number;
    pending: number;
  };
  pendingDeadLetters: number;
  activeSuppressions: number;
  portOrders: {
    total: number;
    submitted: number;
    inProgress: number;
    awaitingDocuments: number;
    completed: number;
  };
}

interface PlatformConnection {
  id: string;
  platform: 'leadconnector' | 'shopify' | 'hubspot' | 'salesforce' | 'zoho';
  platformAccountId: string;
  platformAccountName: string | null;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  installation: {
    lifecycleState:
      | 'installed'
      | 'business_details_needed'
      | 'connection_pending'
      | 'brand_pending'
      | 'campaign_pending'
      | 'campaign_approved'
      | 'number_setup_required'
      | 'port_in_progress'
      | 'provider_not_activated'
      | 'ready'
      | 'error_attention_required';
    checklist: Array<{
      key: string;
      label: string;
      complete: boolean;
      helper: string;
    }>;
  } | null;
}

const statCards = [
  {
    title: 'Messages Sent',
    key: 'messagesSent',
    icon: MessageSquare,
    accent: 'text-sky-700 dark:text-sky-300',
    surface: 'bg-sky-100 dark:bg-sky-500/15',
    trend: 'Operational volume',
  },
  {
    title: 'Delivered',
    key: 'messagesDelivered',
    icon: CheckCircle,
    accent: 'text-emerald-700 dark:text-emerald-300',
    surface: 'bg-emerald-100 dark:bg-emerald-500/15',
    trend: 'Successful delivery',
  },
  {
    title: 'Failed',
    key: 'messagesFailed',
    icon: XCircle,
    accent: 'text-rose-700 dark:text-rose-300',
    surface: 'bg-rose-100 dark:bg-rose-500/15',
    trend: 'Needs review',
  },
  {
    title: 'Delivery Rate',
    key: 'deliveryRate',
    icon: TrendingUp,
    accent: 'text-violet-700 dark:text-violet-300',
    surface: 'bg-violet-100 dark:bg-violet-500/15',
    trend: 'Conversion health',
    isPercent: true,
  },
];

const quickActions = [
  {
    title: 'Continue Onboarding',
    description: 'Work through the embedded GHL rollout from business details to validated traffic.',
    href: '/onboarding',
    icon: ListChecks,
  },
  {
    title: 'Register Brand',
    description: 'Create a compliant brand record before campaigns and phone numbers.',
    href: '/brands/new',
    icon: Building2,
  },
  {
    title: 'Create Campaign',
    description: 'Launch a campaign once a brand is verified and ready for approval.',
    href: '/campaigns/new',
    icon: Megaphone,
  },
  {
    title: 'Connect Platform',
    description: 'Link GoHighLevel and manage the integration from a single surface.',
    href: '/platforms',
    icon: Plug,
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [operations, setOperations] = useState<OperationsSummary | null>(null);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [statsResponse, operationsResponse] = await Promise.all([
          api.getOrganizationStats(),
          api.getOperationsSummary(),
        ]);
        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data);
        }
        if (operationsResponse.success && operationsResponse.data) {
          setOperations(operationsResponse.data);
        }

        const connectionsResponse = await api.getPlatformConnections();
        if (connectionsResponse.success && connectionsResponse.data) {
          setConnections(connectionsResponse.data);
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  const getStatValue = (key: string, isPercent?: boolean) => {
    if (!stats) return '—';

    if (key === 'deliveryRate') {
      const rate = stats.messagesSent > 0
        ? (stats.messagesDelivered / stats.messagesSent) * 100
        : 0;
      return formatPercent(rate);
    }

    const value = stats[key as keyof DashboardStats];
    return typeof value === 'number'
      ? isPercent ? formatPercent(value) : formatNumber(value)
      : '—';
  };

  const detailCards = [
    {
      title: 'Verified Brands',
      value: stats?.verifiedBrands ?? 0,
      description: 'Ready for campaign registration and compliance review.',
      href: '/brands',
      icon: ShieldCheck,
      accent: 'text-sky-700 dark:text-sky-300',
      surface: 'bg-sky-100 dark:bg-sky-500/15',
    },
    {
      title: 'Approved Campaigns',
      value: stats?.activeCampaigns ?? 0,
      description: 'Campaigns currently available for compliant messaging volume.',
      href: '/campaigns',
      icon: Megaphone,
      accent: 'text-violet-700 dark:text-violet-300',
      surface: 'bg-violet-100 dark:bg-violet-500/15',
    },
    {
      title: 'Connected Platforms',
      value: stats?.connectedPlatforms ?? 0,
      description: 'Installed integrations currently linked to your workspace.',
      href: '/platforms',
      icon: Plug,
      accent: 'text-emerald-700 dark:text-emerald-300',
      surface: 'bg-emerald-100 dark:bg-emerald-500/15',
    },
  ];

  const operationalCards = [
    {
      title: 'Pending Dead Letters',
      value: operations?.pendingDeadLetters ?? 0,
      description: 'Queue jobs that failed hard and are waiting for replay.',
      href: '/settings',
      accent: 'text-rose-700 dark:text-rose-300',
      surface: 'bg-rose-100 dark:bg-rose-500/15',
    },
    {
      title: 'Active Suppressions',
      value: operations?.activeSuppressions ?? 0,
      description: 'Contacts currently opted out and blocked from outbound traffic.',
      href: '/settings',
      accent: 'text-amber-700 dark:text-amber-300',
      surface: 'bg-amber-100 dark:bg-amber-500/15',
    },
    {
      title: 'Port Orders',
      value: operations?.portOrders.total ?? 0,
      description: 'Tracked number-port requests in draft, submitted, or active states.',
      href: '/settings',
      accent: 'text-cyan-700 dark:text-cyan-300',
      surface: 'bg-cyan-100 dark:bg-cyan-500/15',
    },
  ];

  const ghlConnection = connections.find((connection) => connection.platform === 'leadconnector') ?? null;
  const checklist = ghlConnection?.installation?.checklist ?? [];
  const completedChecklist = checklist.filter((item) => item.complete).length;
  const lifecycleState = ghlConnection?.installation?.lifecycleState;

  const onboardingAction = (() => {
    if (!ghlConnection) {
      return {
        title: 'Connect GoHighLevel',
        description: 'Link the GHL workspace first so the embedded rollout can begin.',
        href: '/platforms',
        cta: 'Open platforms',
      };
    }

    if (!lifecycleState || lifecycleState === 'installed' || lifecycleState === 'business_details_needed') {
      return {
        title: 'Register business details',
        description: 'Create the brand record that starts the compliance workflow.',
        href: '/brands/new',
        cta: 'Register brand',
      };
    }

    if (lifecycleState === 'brand_pending') {
      return {
        title: 'Wait on brand review',
        description: 'Brand verification is in progress before campaign setup can continue.',
        href: '/brands',
        cta: 'Review brands',
      };
    }

    if (lifecycleState === 'campaign_pending' || lifecycleState === 'campaign_approved') {
      return {
        title: 'Finish campaign setup',
        description: 'Create or monitor the campaign that will be used for compliant traffic.',
        href: '/campaigns',
        cta: 'Open campaigns',
      };
    }

    if (lifecycleState === 'number_setup_required' || lifecycleState === 'port_in_progress') {
      return {
        title: 'Provision numbers',
        description: 'Buy or assign sender numbers after campaign approval.',
        href: '/phone-numbers',
        cta: 'Manage numbers',
      };
    }

    return {
      title: 'Run embedded test traffic',
      description: 'Validate outbound traffic and delivery from inside the embedded app.',
      href: '/messages',
      cta: 'Open messages',
    };
  })();

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Operational visibility across messaging, compliance, and connected systems."
      />

      <div className="space-y-6 p-4 sm:p-6">
        <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-slate-50 shadow-xl shadow-slate-950/10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <Badge className="w-fit bg-white/10 text-slate-100" variant="outline">
                Messaging Overview
              </Badge>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Keep delivery, compliance, and growth in the same view
                </h2>
                <p className="max-w-xl text-sm leading-6 text-slate-300 md:text-base">
                  The dashboard now emphasizes operational clarity instead of decorative
                  gradients, so your team can see message health and platform readiness immediately.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Total Messages</p>
                <p className="mt-2 text-3xl font-semibold">
                  {isLoading ? '—' : formatNumber(stats?.totalMessages ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Delivery Rate</p>
                <p className="mt-2 text-3xl font-semibold">
                  {isLoading ? '—' : getStatValue('deliveryRate', true)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Connected Platforms</p>
                <p className="mt-2 text-3xl font-semibold">
                  {isLoading ? '—' : formatNumber(stats?.connectedPlatforms ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.key} className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div className={`rounded-2xl p-3 ${stat.surface}`}>
                    <stat.icon className={`h-5 w-5 ${stat.accent}`} />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                    {stat.trend}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.title}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {isLoading ? (
                    <span className="inline-block h-9 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  ) : (
                    getStatValue(stat.key, stat.isPercent)
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {detailCards.map((card) => (
            <Card key={card.title} className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className={`inline-flex rounded-2xl p-3 ${card.surface}`}>
                      <card.icon className={`h-5 w-5 ${card.accent}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        {isLoading ? '—' : formatNumber(card.value)}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => navigate(card.href)}>
                    View
                  </Button>
                </div>
                <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {operationalCards.map((card) => (
            <Card key={card.title} className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                      {isLoading ? '—' : formatNumber(card.value)}
                    </p>
                  </div>
                  <div className={`rounded-2xl px-3 py-2 text-sm font-medium ${card.surface} ${card.accent}`}>
                    Ops
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {card.description}
                </p>
                <Button className="mt-5" variant="outline" onClick={() => navigate(card.href)}>
                  Review
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Embedded Rollout</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    The next operational step for the connected GHL workspace.
                  </p>
                </div>
                <Badge variant="outline">
                  {completedChecklist}/{checklist.length || 6} complete
                </Badge>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <h4 className="text-xl font-semibold text-slate-950 dark:text-slate-50">{onboardingAction.title}</h4>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {onboardingAction.description}
                </p>
                <div className="mt-5 flex gap-3">
                  <Button onClick={() => navigate(onboardingAction.href)}>
                    {onboardingAction.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/onboarding')}>
                    View full onboarding
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Checklist Snapshot</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                The first incomplete item is usually the current blocker.
              </p>
              <div className="mt-6 space-y-3">
                {(checklist.length
                  ? checklist
                  : [{ key: 'connect_ghl', label: 'Connect GoHighLevel', complete: false }]).map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="text-sm font-medium text-slate-950 dark:text-slate-50">{item.label}</p>
                    <Badge variant={item.complete ? 'success' : 'secondary'}>
                      {item.complete ? 'Done' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
              onClick={() => navigate(action.href)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-4">
                    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <action.icon className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{action.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
