import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  Award,
  Megaphone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminHeader } from '@/components/layout/admin-header';
import { adminApi } from '@/stores/admin.store';
import { formatNumber } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
  ghlLocationId: string;
  createdAt: string;
  _count: {
    users: number;
    brands: number;
    campaigns: number;
    messages: number;
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadOrganizations();
  }, [page]);

  const loadOrganizations = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getOrganizations(page);
      if (response.success) {
        setOrganizations(response.data);
        setMeta(response.meta);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <AdminHeader title="Organizations" subtitle="Manage all platform organizations" showBack />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary */}
        <div className="mb-6">
          <p className="text-gray-400">
            {meta ? (
              <>Showing {organizations.length} of {meta.total} organizations</>
            ) : (
              'Loading...'
            )}
          </p>
        </div>

        {/* Organizations List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-700 rounded w-1/2 mb-4" />
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-700 rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : organizations.length === 0 ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-12 text-center">
              <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Organizations Yet</h3>
              <p className="text-gray-400">
                Organizations will appear here when users connect via GHL OAuth.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {organizations.map((org, index) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{org.name}</h3>
                        <p className="text-sm text-gray-400 font-mono">{org.ghlLocationId}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mt-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                          <Users className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-lg font-semibold text-white">{formatNumber(org._count.users)}</p>
                        <p className="text-xs text-gray-500">Users</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                          <Award className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-lg font-semibold text-white">{formatNumber(org._count.brands)}</p>
                        <p className="text-xs text-gray-500">Brands</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                          <Megaphone className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-lg font-semibold text-white">{formatNumber(org._count.campaigns)}</p>
                        <p className="text-xs text-gray-500">Campaigns</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-lg font-semibold text-white">{formatNumber(org._count.messages)}</p>
                        <p className="text-xs text-gray-500">Messages</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <p className="text-xs text-gray-500">
                        Created {new Date(org.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border-gray-700 text-gray-300"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-gray-400">
              Page {page} of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="border-gray-700 text-gray-300"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
