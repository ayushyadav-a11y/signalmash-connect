import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plug,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface PlatformConnection {
  id: string;
  platform: 'ghl' | 'shopify' | 'hubspot' | 'salesforce' | 'zoho';
  platformAccountId: string;
  platformAccountName: string;
  status: 'active' | 'inactive' | 'expired' | 'error';
  lastSyncAt: string | null;
  createdAt: string;
}

interface AvailablePlatform {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  available: boolean;
}

const platformConfigs: Record<string, { name: string; color: string; bgColor: string }> = {
  ghl: { name: 'GoHighLevel', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  shopify: { name: 'Shopify', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  hubspot: { name: 'HubSpot', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  salesforce: { name: 'Salesforce', color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
  zoho: { name: 'Zoho', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

const statusConfig = {
  active: { label: 'Connected', icon: CheckCircle, variant: 'success' as const },
  inactive: { label: 'Inactive', icon: Clock, variant: 'secondary' as const },
  expired: { label: 'Expired', icon: XCircle, variant: 'warning' as const },
  error: { label: 'Error', icon: XCircle, variant: 'destructive' as const },
};

const availablePlatforms: AvailablePlatform[] = [
  {
    id: 'ghl',
    name: 'GoHighLevel',
    description: 'Connect your GHL account to enable SMS conversations',
    icon: '🚀',
    color: 'from-blue-500 to-blue-600',
    available: true,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Send order notifications and marketing messages',
    icon: '🛒',
    color: 'from-green-500 to-green-600',
    available: false,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Integrate SMS with your HubSpot CRM',
    icon: '🔶',
    color: 'from-orange-500 to-orange-600',
    available: false,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Connect Salesforce for enterprise SMS automation',
    icon: '☁️',
    color: 'from-cyan-500 to-cyan-600',
    available: false,
  },
  {
    id: 'zoho',
    name: 'Zoho',
    description: 'Integrate with Zoho CRM and marketing tools',
    icon: '📊',
    color: 'from-red-500 to-red-600',
    available: false,
  },
];

export function PlatformsPage() {
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const response = await api.getPlatformConnections();
      if (response.success && response.data) {
        setConnections(response.data);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (platformId: string) => {
    setIsConnecting(platformId);
    try {
      const response = await api.getOAuthUrl(platformId);
      if (response.success && response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Failed to get OAuth URL:', error);
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this platform?')) return;

    try {
      const response = await api.disconnectPlatform(connectionId);
      if (response.success) {
        loadConnections();
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleRefreshToken = async (connectionId: string) => {
    try {
      const response = await api.refreshPlatformToken(connectionId);
      if (response.success) {
        loadConnections();
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }
  };

  const connectedPlatformIds = new Set(connections.map((c) => c.platform));

  return (
    <div>
      <Header
        title="Platforms"
        subtitle="Connect and manage your platform integrations"
      />

      <div className="p-6 space-y-8">
        {/* Connected Platforms */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Connected Platforms</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <Card key={i} variant="glass">
                  <CardContent className="p-6">
                    <div className="animate-pulse flex items-center gap-4">
                      <div className="w-12 h-12 bg-muted rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : connections.length === 0 ? (
            <Card variant="glass">
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
                  <Plug className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No platforms connected</h3>
                <p className="text-sm text-muted-foreground">
                  Connect a platform below to start sending SMS messages through your favorite tools.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connections.map((connection, index) => {
                const platform = platformConfigs[connection.platform];
                const status = statusConfig[connection.status];
                const StatusIcon = status.icon;

                return (
                  <motion.div
                    key={connection.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card variant="glass">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${platform.bgColor}`}>
                              <Plug className={`h-5 w-5 ${platform.color}`} />
                            </div>
                            <div>
                              <h3 className="font-semibold">{platform.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {connection.platformAccountName}
                              </p>
                            </div>
                          </div>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            {connection.lastSyncAt && (
                              <span>
                                Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {(connection.status === 'expired' || connection.status === 'error') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefreshToken(connection.id)}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnect(connection.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Available Platforms */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Available Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availablePlatforms.map((platform, index) => {
              const isConnected = connectedPlatformIds.has(platform.id as any);

              return (
                <motion.div
                  key={platform.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    variant="glass"
                    className={`${
                      platform.available && !isConnected
                        ? 'card-lift cursor-pointer'
                        : 'opacity-75'
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className={`p-3 rounded-xl bg-gradient-to-br ${platform.color} text-2xl`}
                        >
                          {platform.icon}
                        </div>
                        {!platform.available && (
                          <Badge variant="secondary">Coming Soon</Badge>
                        )}
                        {isConnected && (
                          <Badge variant="success">Connected</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold mb-1">{platform.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {platform.description}
                      </p>
                      {platform.available && !isConnected && (
                        <Button
                          className="w-full"
                          onClick={() => handleConnect(platform.id)}
                          isLoading={isConnecting === platform.id}
                          leftIcon={<Plus className="h-4 w-4" />}
                        >
                          Connect
                        </Button>
                      )}
                      {isConnected && (
                        <Button
                          variant="outline"
                          className="w-full"
                          leftIcon={<Settings className="h-4 w-4" />}
                        >
                          Configure
                        </Button>
                      )}
                      {!platform.available && (
                        <Button variant="outline" className="w-full" disabled>
                          Notify Me
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
