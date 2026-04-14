import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/utils';

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'received';
  campaignName: string | null;
  platformName: string | null;
  createdAt: string;
  errorMessage: string | null;
}

const statusConfig = {
  queued: { label: 'Queued', icon: Clock, variant: 'secondary' as const },
  sent: { label: 'Sent', icon: Send, variant: 'warning' as const },
  delivered: { label: 'Delivered', icon: CheckCircle, variant: 'success' as const },
  failed: { label: 'Failed', icon: XCircle, variant: 'destructive' as const },
  received: { label: 'Received', icon: ArrowDownLeft, variant: 'default' as const },
};

export function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const response = await api.getMessages();
      if (response.success && response.data) {
        setMessages(response.data);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadMessages();
    setIsRefreshing(false);
  }, []);

  const filteredMessages = messages.filter((message) => {
    const matchesSearch =
      message.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.from.includes(searchQuery) ||
      message.to.includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || message.status === statusFilter;
    const matchesDirection = directionFilter === 'all' || message.direction === directionFilter;

    return matchesSearch && matchesStatus && matchesDirection;
  });

  return (
    <div>
      <Header
        title="Messages"
        subtitle="View and track all SMS messages"
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Input
              placeholder="Search messages, phone numbers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="all">All Directions</option>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="delivered">Delivered</option>
            <option value="sent">Sent</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
            <option value="received">Received</option>
          </select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Messages List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <Card key={i} variant="glass">
                <CardContent className="p-4">
                  <div className="animate-pulse flex items-center gap-4">
                    <div className="w-10 h-10 bg-muted rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                    </div>
                    <div className="h-6 bg-muted rounded w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredMessages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="inline-flex p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-4">
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No messages found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery || statusFilter !== 'all' || directionFilter !== 'all'
                ? 'Try adjusting your filters to see more messages.'
                : 'Messages will appear here once you start sending or receiving SMS.'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((message, index) => {
              const status = statusConfig[message.status];
              const StatusIcon = status.icon;
              const isOutbound = message.direction === 'outbound';

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card variant="glass" className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Direction Icon */}
                        <div className={`p-2.5 rounded-xl ${
                          isOutbound
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : 'bg-green-100 dark:bg-green-900/30'
                        }`}>
                          {isOutbound ? (
                            <ArrowUpRight className="h-4 w-4 text-blue-600" />
                          ) : (
                            <ArrowDownLeft className="h-4 w-4 text-green-600" />
                          )}
                        </div>

                        {/* Message Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {isOutbound ? 'To: ' : 'From: '}
                              {formatPhoneNumber(isOutbound ? message.to : message.from)}
                            </span>
                            {message.campaignName && (
                              <Badge variant="outline" className="text-xs">
                                {message.campaignName}
                              </Badge>
                            )}
                            {message.platformName && (
                              <Badge variant="outline" className="text-xs">
                                {message.platformName}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {message.body}
                          </p>
                          {message.status === 'failed' && message.errorMessage && (
                            <p className="text-xs text-destructive mt-1">
                              Error: {message.errorMessage}
                            </p>
                          )}
                        </div>

                        {/* Status & Time */}
                        <div className="text-right flex-shrink-0">
                          <Badge variant={status.variant} className="gap-1 mb-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination hint */}
        {filteredMessages.length >= 50 && (
          <div className="text-center">
            <Button variant="outline">Load More</Button>
          </div>
        )}
      </div>
    </div>
  );
}
