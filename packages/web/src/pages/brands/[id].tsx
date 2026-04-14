import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Mail,
  MapPin,
  Globe,
  Calendar,
  Megaphone,
  Plus,
  Send,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface Brand {
  id: string;
  legalName: string;
  dba: string | null;
  ein: string;
  vertical: string;
  website: string | null;
  description: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  signalmashBrandId: string | null;
  status: 'draft' | 'pending' | 'verified' | 'rejected' | 'suspended';
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  campaigns: Array<{
    id: string;
    name: string;
    useCase: string;
    status: string;
  }>;
}

const statusConfig = {
  draft: { label: 'Draft', icon: FileText, variant: 'secondary' as const, color: 'text-gray-600' },
  pending: { label: 'Pending Verification', icon: Clock, variant: 'warning' as const, color: 'text-yellow-600' },
  verified: { label: 'Verified', icon: CheckCircle, variant: 'success' as const, color: 'text-green-600' },
  rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' as const, color: 'text-red-600' },
  suspended: { label: 'Suspended', icon: AlertCircle, variant: 'destructive' as const, color: 'text-red-600' },
};

export function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadBrand();
    }
  }, [id]);

  const loadBrand = async () => {
    try {
      const response = await api.getBrand(id!);
      if (response.success && response.data) {
        setBrand(response.data);
      }
    } catch (error) {
      console.error('Failed to load brand:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitForVerification = async () => {
    if (!brand) return;
    setIsSubmitting(true);
    try {
      const response = await api.submitBrand(brand.id);
      if (response.success) {
        loadBrand();
      }
    } catch (error) {
      console.error('Failed to submit brand:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <Header title="Brand Details" />
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-48 bg-muted rounded-2xl" />
                <div className="h-32 bg-muted rounded-2xl" />
              </div>
              <div className="h-64 bg-muted rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div>
        <Header title="Brand Not Found" />
        <div className="p-6 text-center">
          <p className="text-muted-foreground mb-4">The brand you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/brands')}>Back to Brands</Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[brand.status];
  const StatusIcon = status.icon;

  return (
    <div>
      <Header
        title={brand.legalName}
        subtitle={brand.dba ? `DBA: ${brand.dba}` : undefined}
      />

      <div className="p-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/brands')}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Brands
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
                        brand.status === 'verified' ? 'bg-green-100 dark:bg-green-900/30' :
                        brand.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                        brand.status === 'rejected' || brand.status === 'suspended' ? 'bg-red-100 dark:bg-red-900/30' :
                        'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <StatusIcon className={`h-6 w-6 ${status.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{status.label}</h3>
                        {brand.status === 'rejected' && brand.rejectionReason && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Reason: {brand.rejectionReason}
                          </p>
                        )}
                        {brand.status === 'pending' && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Verification typically takes 1-3 business days
                          </p>
                        )}
                      </div>
                    </div>
                    {brand.status === 'draft' && (
                      <Button
                        onClick={handleSubmitForVerification}
                        isLoading={isSubmitting}
                        leftIcon={<Send className="h-4 w-4" />}
                      >
                        Submit for Verification
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Business Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Business Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Legal Name</p>
                      <p className="font-medium">{brand.legalName}</p>
                    </div>
                    {brand.dba && (
                      <div>
                        <p className="text-sm text-muted-foreground">DBA</p>
                        <p className="font-medium">{brand.dba}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">EIN</p>
                      <p className="font-medium font-mono">{brand.ein}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vertical</p>
                      <p className="font-medium capitalize">{brand.vertical.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{brand.description}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-purple-600" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Name</p>
                      <p className="font-medium">
                        {brand.contactFirstName} {brand.contactLastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{brand.contactEmail}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{brand.contactPhone}</p>
                    </div>
                    {brand.website && (
                      <div>
                        <p className="text-sm text-muted-foreground">Website</p>
                        <a
                          href={brand.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {brand.website}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Address */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-green-600" />
                    Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">
                    {brand.address.street}
                    <br />
                    {brand.address.city}, {brand.address.state} {brand.address.postalCode}
                    <br />
                    {brand.address.country}
                  </p>
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
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {new Date(brand.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {brand.signalmashBrandId && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Brand ID</p>
                        <p className="font-medium font-mono text-sm">
                          {brand.signalmashBrandId}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Campaigns */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card variant="glass">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-purple-600" />
                      Campaigns
                    </CardTitle>
                    {brand.status === 'verified' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/campaigns/new?brandId=${brand.id}`)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {brand.campaigns.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        No campaigns yet
                      </p>
                      {brand.status === 'verified' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/campaigns/new?brandId=${brand.id}`)}
                          leftIcon={<Plus className="h-4 w-4" />}
                        >
                          Create Campaign
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {brand.campaigns.map((campaign) => (
                        <div
                          key={campaign.id}
                          className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          onClick={() => navigate(`/campaigns/${campaign.id}`)}
                        >
                          <p className="font-medium text-sm">{campaign.name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground capitalize">
                              {campaign.useCase.replace(/_/g, ' ')}
                            </p>
                            <Badge
                              variant={
                                campaign.status === 'active' ? 'success' :
                                campaign.status === 'pending' ? 'warning' : 'secondary'
                              }
                              className="text-xs"
                            >
                              {campaign.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
