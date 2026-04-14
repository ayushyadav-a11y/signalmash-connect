import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface Brand {
  id: string;
  legalName: string;
  dba: string | null;
  vertical: string;
  status: 'draft' | 'pending' | 'verified' | 'rejected' | 'suspended';
  createdAt: string;
  campaignCount: number;
}

const statusConfig = {
  draft: { label: 'Draft', icon: FileText, variant: 'secondary' as const },
  pending: { label: 'Pending', icon: Clock, variant: 'warning' as const },
  verified: { label: 'Verified', icon: CheckCircle, variant: 'success' as const },
  rejected: { label: 'Rejected', icon: XCircle, variant: 'destructive' as const },
  suspended: { label: 'Suspended', icon: AlertCircle, variant: 'destructive' as const },
};

export function BrandsPage() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      const response = await api.getBrands();
      if (response.success && response.data) {
        setBrands(response.data);
      }
    } catch (error) {
      console.error('Failed to load brands:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBrands = brands.filter(
    (brand) =>
      brand.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.dba?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <Header
        title="Brands"
        subtitle="Manage your 10DLC brand registrations"
        action={{
          label: 'Register Brand',
          onClick: () => navigate('/brands/new'),
        }}
      />

      <div className="p-6 space-y-6">
        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Input
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Brands Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} variant="glass">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-muted rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="flex justify-between">
                      <div className="h-6 bg-muted rounded w-20" />
                      <div className="h-6 bg-muted rounded w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredBrands.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="inline-flex p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-4">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No brands registered</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Register your first brand to start sending SMS messages through
              10DLC compliant channels.
            </p>
            <Button onClick={() => navigate('/brands/new')} leftIcon={<Plus className="h-4 w-4" />}>
              Register Brand
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBrands.map((brand, index) => {
              const status = statusConfig[brand.status];
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={brand.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    variant="glass"
                    className="card-lift cursor-pointer group"
                    onClick={() => navigate(`/brands/${brand.id}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 group-hover:scale-110 transition-transform duration-300">
                            <Building2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{brand.legalName}</h3>
                            {brand.dba && (
                              <p className="text-sm text-muted-foreground">
                                DBA: {brand.dba}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Menu actions
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4 capitalize">
                        {brand.vertical.replace(/_/g, ' ')}
                      </p>

                      <div className="flex items-center justify-between">
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {brand.campaignCount} campaign{brand.campaignCount !== 1 ? 's' : ''}
                        </span>
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
