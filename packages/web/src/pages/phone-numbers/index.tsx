import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Plus,
  Search,
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Trash2,
  Edit2,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { SearchNumbersDialog } from './search-dialog';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  formattedNumber: string;
  friendlyName: string | null;
  areaCode: string | null;
  smsCapable: boolean;
  mmsCapable: boolean;
  voiceCapable: boolean;
  status: 'active' | 'pending' | 'suspended' | 'released';
  campaign: {
    id: string;
    name: string;
    status: string;
  } | null;
  _count: {
    messages: number;
  };
  createdAt: string;
}

interface Stats {
  total: number;
  active: number;
  pending: number;
  released: number;
  byAreaCode: Array<{ areaCode: string; count: number }>;
}

const statusConfig = {
  active: { label: 'Active', icon: CheckCircle, variant: 'success' as const },
  pending: { label: 'Pending', icon: Clock, variant: 'warning' as const },
  suspended: { label: 'Suspended', icon: AlertTriangle, variant: 'destructive' as const },
  released: { label: 'Released', icon: XCircle, variant: 'secondary' as const },
};

export function PhoneNumbersPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [numbersRes, statsRes] = await Promise.all([
        api.getPhoneNumbers(),
        api.getPhoneNumberStats(),
      ]);

      if (numbersRes.success && numbersRes.data) {
        setPhoneNumbers(numbersRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Failed to load phone numbers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReleaseNumber = async () => {
    if (!selectedNumber) return;

    setIsReleasing(true);
    try {
      await api.releasePhoneNumber(selectedNumber.id);
      await loadData();
      setShowReleaseDialog(false);
      setSelectedNumber(null);
    } catch (error) {
      console.error('Failed to release number:', error);
    } finally {
      setIsReleasing(false);
    }
  };

  const filteredNumbers = phoneNumbers.filter(
    (num) =>
      num.phoneNumber.includes(searchQuery) ||
      num.formattedNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      num.friendlyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      num.campaign?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <Header
        title="Phone Numbers"
        subtitle="Manage your DIDs and phone number inventory"
        action={{
          label: 'Buy Number',
          onClick: () => setShowSearchDialog(true),
        }}
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card variant="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Numbers</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{stats.active}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900/30">
                    <XCircle className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Released</p>
                    <p className="text-2xl font-bold">{stats.released}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Input
              placeholder="Search by number, name, or campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* Phone Numbers List */}
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
        ) : filteredNumbers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="inline-flex p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-4">
              <Phone className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No phone numbers yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Purchase phone numbers to start sending and receiving SMS messages
              through your campaigns.
            </p>
            <Button
              onClick={() => setShowSearchDialog(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Buy Phone Number
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredNumbers.map((number, index) => {
              const status = statusConfig[number.status];
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={number.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card variant="glass" className="group">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                          <Phone className="h-5 w-5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold font-mono text-lg">
                            {number.formattedNumber}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {number.friendlyName && (
                              <>
                                <span>{number.friendlyName}</span>
                                <span>•</span>
                              </>
                            )}
                            {number.campaign ? (
                              <span className="text-primary">{number.campaign.name}</span>
                            ) : (
                              <span className="text-yellow-600">No campaign assigned</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Capabilities */}
                          <div className="hidden md:flex items-center gap-2">
                            {number.smsCapable && (
                              <Badge variant="outline" className="text-xs">SMS</Badge>
                            )}
                            {number.mmsCapable && (
                              <Badge variant="outline" className="text-xs">MMS</Badge>
                            )}
                            {number.voiceCapable && (
                              <Badge variant="outline" className="text-xs">Voice</Badge>
                            )}
                          </div>

                          <div className="text-right hidden sm:block">
                            <div className="flex items-center gap-1 text-sm">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {formatNumber(number._count.messages)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">messages</p>
                          </div>

                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedNumber(number);
                                  setShowReleaseDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Release Number
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Search & Purchase Dialog */}
      <SearchNumbersDialog
        open={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
        onPurchased={loadData}
      />

      {/* Release Confirmation Dialog */}
      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Phone Number</DialogTitle>
            <DialogDescription>
              Are you sure you want to release{' '}
              <span className="font-mono font-semibold">
                {selectedNumber?.formattedNumber}
              </span>
              ? This action cannot be undone and you will lose this number.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReleaseDialog(false)}
              disabled={isReleasing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReleaseNumber}
              isLoading={isReleasing}
            >
              Release Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
