import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Search,
  Check,
  MapPin,
  MessageSquare,
  Image,
  PhoneCall,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AvailableNumber {
  phoneNumber: string;
  formattedNumber: string;
  areaCode: string;
  capabilities: {
    sms: boolean;
    mms: boolean;
    voice: boolean;
  };
  monthlyPrice: number;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface SearchNumbersDialogProps {
  open: boolean;
  onClose: () => void;
  onPurchased: () => void;
}

// Common US area codes by state
const AREA_CODES: Record<string, string[]> = {
  'California': ['213', '310', '323', '408', '415', '510', '619', '650', '714', '818', '858', '909', '949'],
  'Texas': ['214', '281', '512', '713', '817', '832', '972'],
  'New York': ['212', '315', '347', '516', '518', '585', '607', '631', '646', '716', '718', '845', '914', '917'],
  'Florida': ['305', '321', '352', '386', '407', '561', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954'],
  'Illinois': ['217', '224', '309', '312', '618', '630', '708', '773', '815', '847'],
};

export function SearchNumbersDialog({ open, onClose, onPurchased }: SearchNumbersDialogProps) {
  const [step, setStep] = useState<'search' | 'select' | 'purchase'>('search');
  const [isSearching, setIsSearching] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [areaCode, setAreaCode] = useState('');
  const [contains, setContains] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumber | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [friendlyName, setFriendlyName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      loadCampaigns();
    }
  }, [open]);

  const loadCampaigns = async () => {
    try {
      const response = await api.getCampaigns({ status: 'approved' });
      if (response.success && response.data) {
        setCampaigns(response.data);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };

  const handleSearch = async () => {
    if (!areaCode && !contains) {
      setError('Please enter an area code or digits to search');
      return;
    }

    setError('');
    setIsSearching(true);

    try {
      const response = await api.searchAvailableNumbers({
        areaCode: areaCode || undefined,
        contains: contains || undefined,
        limit: 20,
      });

      if (response.success && response.data) {
        setAvailableNumbers(response.data);
        setStep('select');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to search for numbers');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectNumber = (number: AvailableNumber) => {
    setSelectedNumber(number);
    setStep('purchase');
  };

  const handlePurchase = async () => {
    if (!selectedNumber) return;

    setIsPurchasing(true);
    setError('');

    try {
      const response = await api.purchasePhoneNumber({
        phoneNumber: selectedNumber.phoneNumber,
        campaignId: selectedCampaignId || undefined,
        friendlyName: friendlyName || undefined,
      });

      if (response.success) {
        onPurchased();
        handleClose();
      }
    } catch (error: any) {
      setError(error.message || 'Failed to purchase number');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleClose = () => {
    setStep('search');
    setAreaCode('');
    setContains('');
    setAvailableNumbers([]);
    setSelectedNumber(null);
    setSelectedCampaignId('');
    setFriendlyName('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {step === 'search' && 'Search Phone Numbers'}
            {step === 'select' && 'Select a Number'}
            {step === 'purchase' && 'Purchase Number'}
          </DialogTitle>
          <DialogDescription>
            {step === 'search' && 'Find available phone numbers by area code or containing specific digits'}
            {step === 'select' && `Found ${availableNumbers.length} available numbers`}
            {step === 'purchase' && 'Configure and purchase your selected number'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <AnimatePresence mode="wait">
            {/* Step 1: Search */}
            {step === 'search' && (
              <motion.div
                key="search"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Area Code</Label>
                    <Input
                      placeholder="e.g., 415, 212, 310"
                      value={areaCode}
                      onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      leftIcon={<MapPin className="h-4 w-4" />}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a 3-digit US area code
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Contains (optional)</Label>
                    <Input
                      placeholder="e.g., 1234"
                      value={contains}
                      onChange={(e) => setContains(e.target.value.replace(/\D/g, '').slice(0, 7))}
                      leftIcon={<Search className="h-4 w-4" />}
                    />
                    <p className="text-xs text-muted-foreground">
                      Search for numbers containing specific digits
                    </p>
                  </div>
                </div>

                {/* Quick Select Area Codes */}
                <div className="space-y-3">
                  <Label>Popular Area Codes</Label>
                  <div className="space-y-2">
                    {Object.entries(AREA_CODES).slice(0, 3).map(([state, codes]) => (
                      <div key={state}>
                        <p className="text-xs text-muted-foreground mb-1">{state}</p>
                        <div className="flex flex-wrap gap-1">
                          {codes.slice(0, 6).map((code) => (
                            <Button
                              key={code}
                              variant={areaCode === code ? 'default' : 'outline'}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setAreaCode(code)}
                            >
                              {code}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  onClick={handleSearch}
                  isLoading={isSearching}
                  className="w-full"
                  leftIcon={<Search className="h-4 w-4" />}
                >
                  Search Available Numbers
                </Button>
              </motion.div>
            )}

            {/* Step 2: Select */}
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('search')}
                >
                  &larr; Back to search
                </Button>

                {availableNumbers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No numbers found. Try a different search.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {availableNumbers.map((number) => (
                      <Card
                        key={number.phoneNumber}
                        variant="glass"
                        className={cn(
                          'cursor-pointer transition-all',
                          selectedNumber?.phoneNumber === number.phoneNumber
                            ? 'ring-2 ring-primary'
                            : 'hover:bg-accent'
                        )}
                        onClick={() => handleSelectNumber(number)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono font-semibold text-lg">
                                {number.formattedNumber}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {number.capabilities.sms && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <MessageSquare className="h-3 w-3" /> SMS
                                  </Badge>
                                )}
                                {number.capabilities.mms && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Image className="h-3 w-3" /> MMS
                                  </Badge>
                                )}
                                {number.capabilities.voice && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <PhoneCall className="h-3 w-3" /> Voice
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Monthly</p>
                              <p className="font-semibold text-lg">
                                ${number.monthlyPrice.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Purchase */}
            {step === 'purchase' && selectedNumber && (
              <motion.div
                key="purchase"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('select')}
                >
                  &larr; Back to selection
                </Button>

                {/* Selected Number Summary */}
                <Card variant="glass" className="bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Selected Number</p>
                        <p className="font-mono font-bold text-2xl">
                          {selectedNumber.formattedNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Monthly Cost</p>
                        <p className="font-bold text-2xl text-primary">
                          ${selectedNumber.monthlyPrice.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Configuration */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Friendly Name (optional)</Label>
                    <Input
                      placeholder="e.g., Main Business Line"
                      value={friendlyName}
                      onChange={(e) => setFriendlyName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Assign to Campaign (optional)</Label>
                    <Select
                      value={selectedCampaignId}
                      onValueChange={setSelectedCampaignId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No campaign</SelectItem>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Assign to an approved campaign for 10DLC compliance
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  onClick={handlePurchase}
                  isLoading={isPurchasing}
                  className="w-full"
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Purchase for ${selectedNumber.monthlyPrice.toFixed(2)}/month
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
