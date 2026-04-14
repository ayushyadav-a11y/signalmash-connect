import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Megaphone,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  Pause,
  Play,
  Send,
  MessageSquare,
  Building2,
  Calendar,
  BarChart3,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  brand: {
    id: string;
    legalName: string;
  };
  useCase: string;
  description: string;
  sampleMessages: string[];
  signalmashCampaignId: string | null;
  status: 'draft' | 'pending' | 'active' | 'paused' | 'rejected' | 'expired';
  rejectionReason: string | null;
  optInKeywords: string[];
  optOutKeywords: string[];
  helpKeywords: string[];
  optInMessage: string | null;
  optOutMessage: string | null;
  helpMessage: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalMessages: number;
    delivered: number;
    failed: number;
    pending: number;
  };
}

const statusConfig = {
  draft: { label: 'Draft', icon: FileText, variant: 'secondary' as const, color: 'text-gray-600' },
  pending: { label: 'Pending Approval', icon: Clock, variant: 'warning' as const, color: 'text-yellow-600' },
  active: { label: 'Active', icon: CheckCircle, variant: 'success' as const, color: 'text-green-600' },
  paused: { label: 'Paused', icon: Pause, variant: 'secondary' as const, color: 'text-gray-600' },
  rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' as const, color: 'text-red-600' },
  expired: { label: 'Expired', icon: AlertCircle, variant: 'destructive' as const, color: 'text-red-600' },
};

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadCampaign();
    }
  }, [id]);

  const loadCampaign = async () => {
    try {
      const response = await api.getCampaign(id!);
      if (response.success && response.data) {
        setCampaign(response.data);
      }
    } catch (error) {
      console.error('Failed to load campaign:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!campaign) return;
    setIsSubmitting(true);
    try {
      const response = await api.submitCampaign(campaign.id);
      if (response.success) {
        loadCampaign();
      }
    } catch (error) {
      console.error('Failed to submit campaign:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePauseCampaign = async () => {
    if (!campaign) return;
    setIsSubmitting(true);
    try {
      const response = await api.pauseCampaign(campaign.id);
      if (response.success) {
        loadCampaign();
      }
    } catch (error) {
      console.error('Failed to pause campaign:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeCampaign = async () => {
    if (!campaign) return;
    setIsSubmitting(true);
    try {
      const response = await api.resumeCampaign(campaign.id);
      if (response.success) {
        loadCampaign();
      }
    } catch (error) {
      console.error('Failed to resume campaign:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <Header title="Campaign Details" />
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-32 bg-muted rounded-2xl" />
                <div className="h-48 bg-muted rounded-2xl" />
              </div>
              <div className="h-64 bg-muted rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div>
        <Header title="Campaign Not Found" />
        <div className="p-6 text-center">
          <p className="text-muted-foreground mb-4">The campaign you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/campaigns')}>Back to Campaigns</Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[campaign.status];
  const StatusIcon = status.icon;
  const deliveryRate = campaign.stats.totalMessages > 0
    ? ((campaign.stats.delivered / campaign.stats.totalMessages) * 100).toFixed(1)
    : '0';

  return (
    <div>
      <Header
        title={campaign.name}
        subtitle={`${campaign.brand.legalName} • ${campaign.useCase.replace(/_/g, ' ')}`}
      />

      <div className="p-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/campaigns')}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Campaigns
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card variant="glass">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl ${
                        campaign.status === 'active' ? 'bg-green-100 dark:bg-green-900/30' :
                        campaign.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                        campaign.status === 'rejected' || campaign.status === 'expired' ? 'bg-red-100 dark:bg-red-900/30' :
                        'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <StatusIcon className={`h-6 w-6 ${status.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{status.label}</h3>
                        {campaign.status === 'rejected' && campaign.rejectionReason && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Reason: {campaign.rejectionReason}
                          </p>
                        )}
                        {campaign.status === 'pending' && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Approval typically takes 1-5 business days
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {campaign.status === 'draft' && (
                        <Button
                          onClick={handleSubmitForApproval}
                          isLoading={isSubmitting}
                          leftIcon={<Send className="h-4 w-4" />}
                        >
                          Submit for Approval
                        </Button>
                      )}
                      {campaign.status === 'active' && (
                        <Button
                          variant="outline"
                          onClick={handlePauseCampaign}
                          isLoading={isSubmitting}
                          leftIcon={<Pause className="h-4 w-4" />}
                        >
                          Pause
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <Button
                          onClick={handleResumeCampaign}
                          isLoading={isSubmitting}
                          leftIcon={<Play className="h-4 w-4" />}
                        >
                          Resume
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Stats */}
            {campaign.status === 'active' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="grid grid-cols-4 gap-4">
                  <Card variant="glass">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold">{formatNumber(campaign.stats.totalMessages)}</p>
                      <p className="text-sm text-muted-foreground">Total Sent</p>
                    </CardContent>
                  </Card>
                  <Card variant="glass">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{formatNumber(campaign.stats.delivered)}</p>
                      <p className="text-sm text-muted-foreground">Delivered</p>
                    </CardContent>
                  </Card>
                  <Card variant="glass">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{formatNumber(campaign.stats.failed)}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </CardContent>
                  </Card>
                  <Card variant="glass">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{deliveryRate}%</p>
                      <p className="text-sm text-muted-foreground">Delivery Rate</p>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {/* Campaign Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-purple-600" />
                    Campaign Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Use Case</p>
                    <p className="font-medium capitalize">{campaign.useCase.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{campaign.description}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Sample Messages */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                    Sample Messages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {campaign.sampleMessages.map((message, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                      >
                        <p className="text-sm whitespace-pre-wrap">{message}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Compliance Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    Compliance Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Opt-Out Keywords</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {campaign.optOutKeywords.map((kw, i) => (
                          <Badge key={i} variant="secondary">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Help Keywords</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {campaign.helpKeywords.map((kw, i) => (
                          <Badge key={i} variant="secondary">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                    {campaign.optInKeywords.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Opt-In Keywords</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {campaign.optInKeywords.map((kw, i) => (
                            <Badge key={i} variant="secondary">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {campaign.optOutMessage && (
                    <div>
                      <p className="text-sm text-muted-foreground">Opt-Out Response</p>
                      <p className="text-sm mt-1">{campaign.optOutMessage}</p>
                    </div>
                  )}
                  {campaign.helpMessage && (
                    <div>
                      <p className="text-sm text-muted-foreground">Help Response</p>
                      <p className="text-sm mt-1">{campaign.helpMessage}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="text-base">Quick Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Brand</p>
                      <button
                        onClick={() => navigate(`/brands/${campaign.brand.id}`)}
                        className="font-medium text-primary hover:underline"
                      >
                        {campaign.brand.legalName}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {campaign.signalmashCampaignId && (
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Campaign ID</p>
                        <p className="font-medium font-mono text-sm">
                          {campaign.signalmashCampaignId}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            {campaign.status === 'active' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => navigate('/messages')}
                      leftIcon={<MessageSquare className="h-4 w-4" />}
                    >
                      View Messages
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      leftIcon={<Send className="h-4 w-4" />}
                    >
                      Send Test Message
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
