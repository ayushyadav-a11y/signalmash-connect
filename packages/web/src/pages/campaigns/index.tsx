import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Megaphone,
  Plus,
  Search,
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  Pause,
  MessageSquare,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  brandName: string;
  useCase: string;
  status: 'draft' | 'pending' | 'active' | 'paused' | 'rejected' | 'expired';
  messageCount: number;
  createdAt: string;
}

const statusConfig = {
  draft: { label: 'Draft', icon: Megaphone, variant: 'secondary' as const },
  pending: { label: 'Pending', icon: Clock, variant: 'warning' as const },
  active: { label: 'Active', icon: CheckCircle, variant: 'success' as const },
  paused: { label: 'Paused', icon: Pause, variant: 'secondary' as const },
  rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' as const },
  expired: { label: 'Expired', icon: Clock, variant: 'destructive' as const },
};

export function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await api.getCampaigns();
      if (response.success && response.data) {
        setCampaigns(response.data);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(
    (campaign) =>
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.brandName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <Header
        title="Campaigns"
        subtitle="Manage your 10DLC messaging campaigns"
        action={{
          label: 'Create Campaign',
          onClick: () => navigate('/campaigns/new'),
        }}
      />

      <div className="p-6 space-y-6">
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Campaigns List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} variant="glass">
                <CardContent className="p-6">
                  <div className="animate-pulse flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                    <div className="h-6 bg-muted rounded w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="inline-flex p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30 mb-4">
              <Megaphone className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No campaigns created</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create a campaign to start sending SMS messages. You'll need a
              verified brand first.
            </p>
            <Button
              onClick={() => navigate('/campaigns/new')}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Campaign
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredCampaigns.map((campaign, index) => {
              const status = statusConfig[campaign.status];
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    variant="glass"
                    className="card-lift cursor-pointer group"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 group-hover:scale-110 transition-transform duration-300">
                          <Megaphone className="h-5 w-5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{campaign.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{campaign.brandName}</span>
                            <span>•</span>
                            <span className="capitalize">
                              {campaign.useCase.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <div className="flex items-center gap-1 text-sm">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {formatNumber(campaign.messageCount)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">messages</p>
                          </div>

                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
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
    </div>
  );
}
