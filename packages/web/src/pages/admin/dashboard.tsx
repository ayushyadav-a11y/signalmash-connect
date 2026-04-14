import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  MessageSquare,
  Megaphone,
  Award,
  Activity,
  Key,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/stores/admin.store';
import { AdminHeader } from '@/components/layout/admin-header';
import { formatNumber } from '@/lib/utils';

interface DashboardStats {
  totalOrganizations: number;
  totalUsers: number;
  totalBrands: number;
  totalCampaigns: number;
  totalMessages: number;
  messagesLast24h: number;
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await adminApi.getDashboard();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    { title: 'Organizations', value: stats?.totalOrganizations ?? 0, icon: Building2, color: 'from-blue-500 to-blue-600' },
    { title: 'Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'from-green-500 to-green-600' },
    { title: 'Brands', value: stats?.totalBrands ?? 0, icon: Award, color: 'from-purple-500 to-purple-600' },
    { title: 'Campaigns', value: stats?.totalCampaigns ?? 0, icon: Megaphone, color: 'from-orange-500 to-orange-600' },
    { title: 'Total Messages', value: stats?.totalMessages ?? 0, icon: MessageSquare, color: 'from-cyan-500 to-cyan-600' },
    { title: 'Messages (24h)', value: stats?.messagesLast24h ?? 0, icon: Activity, color: 'from-pink-500 to-pink-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <AdminHeader title="Admin Portal" subtitle="SignalMash Connect" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">{stat.title}</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {isLoading ? (
                          <span className="inline-block w-16 h-8 bg-gray-700 animate-pulse rounded" />
                        ) : (
                          formatNumber(stat.value)
                        )}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card
              className="bg-gray-800/50 border-gray-700 cursor-pointer hover:bg-gray-700/50 transition-colors"
              onClick={() => navigate('/admin/settings')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                    <Key className="h-5 w-5 text-white" />
                  </div>
                  API Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-sm">
                  Configure Signalmash API key, GHL credentials, and other integration settings.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card
              className="bg-gray-800/50 border-gray-700 cursor-pointer hover:bg-gray-700/50 transition-colors"
              onClick={() => navigate('/admin/organizations')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  Organizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-sm">
                  View and manage all organizations using the platform.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
