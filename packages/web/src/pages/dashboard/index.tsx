import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  TrendingUp,
  Building2,
  Megaphone,
  Plug,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  totalMessages: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesFailed: number;
  connectedPlatforms: number;
  activeCampaigns: number;
  verifiedBrands: number;
}

const statCards = [
  {
    title: 'Messages Sent',
    key: 'messagesSent',
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    trend: '+12.5%',
    trendUp: true,
  },
  {
    title: 'Delivered',
    key: 'messagesDelivered',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    trend: '+8.2%',
    trendUp: true,
  },
  {
    title: 'Failed',
    key: 'messagesFailed',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    trend: '-2.1%',
    trendUp: false,
  },
  {
    title: 'Delivery Rate',
    key: 'deliveryRate',
    icon: TrendingUp,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    isPercent: true,
    trend: '+1.5%',
    trendUp: true,
  },
];

const quickActions = [
  {
    title: 'Register Brand',
    description: 'Set up your 10DLC brand for SMS',
    icon: Building2,
    href: '/brands/new',
    color: 'from-blue-500 to-blue-600',
  },
  {
    title: 'Create Campaign',
    description: 'Launch a new messaging campaign',
    icon: Megaphone,
    href: '/campaigns/new',
    color: 'from-purple-500 to-purple-600',
  },
  {
    title: 'Connect Platform',
    description: 'Link GHL, Shopify, or more',
    icon: Plug,
    href: '/platforms',
    color: 'from-green-500 to-green-600',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.getOrganizationStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatValue = (key: string, isPercent?: boolean) => {
    if (!stats) return '—';

    if (key === 'deliveryRate') {
      const rate = stats.messagesSent > 0
        ? (stats.messagesDelivered / stats.messagesSent) * 100
        : 0;
      return formatPercent(rate);
    }

    const value = stats[key as keyof DashboardStats];
    if (typeof value === 'number') {
      return isPercent ? formatPercent(value) : formatNumber(value);
    }
    return '—';
  };

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Welcome back! Here's an overview of your messaging activity."
      />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card variant="glass" className="card-lift">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <Badge
                      variant={stat.trendUp ? 'success' : 'destructive'}
                      className="gap-1"
                    >
                      {stat.trendUp ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {stat.trend}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold mt-1">
                      {isLoading ? (
                        <span className="inline-block w-16 h-8 bg-muted animate-pulse rounded" />
                      ) : (
                        getStatValue(stat.key, stat.isPercent)
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <motion.div
                key={action.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <Card
                  variant="glass"
                  className="card-lift cursor-pointer group"
                  onClick={() => navigate(action.href)}
                >
                  <CardContent className="p-6">
                    <div
                      className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${action.color} mb-4 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <action.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-semibold mb-1">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Brands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats?.verifiedBrands ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Verified</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/brands')}>
                  View all
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-purple-600" />
                Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats?.activeCampaigns ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/campaigns')}>
                  View all
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plug className="h-5 w-5 text-green-600" />
                Platforms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{stats?.connectedPlatforms ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Connected</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/platforms')}>
                  View all
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
