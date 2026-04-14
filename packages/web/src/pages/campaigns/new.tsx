import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Megaphone,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Building2,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  brandId: z.string().min(1, 'Please select a brand'),
  useCase: z.string().min(1, 'Use case is required'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  sampleMessages: z.array(z.string().min(1)).min(1, 'At least one sample message is required'),
  messageFlow: z.string().optional(),
  optInKeywords: z.string().optional(),
  optOutKeywords: z.string().optional(),
  helpKeywords: z.string().optional(),
  optInMessage: z.string().optional(),
  optOutMessage: z.string().optional(),
  helpMessage: z.string().optional(),
});

type CampaignForm = z.infer<typeof campaignSchema>;

interface Brand {
  id: string;
  legalName: string;
  status: string;
}

const useCases = [
  { value: 'marketing', label: 'Marketing', description: 'Promotional messages, offers, and advertisements' },
  { value: 'customer_care', label: 'Customer Care', description: 'Support, service updates, and customer assistance' },
  { value: 'account_notifications', label: 'Account Notifications', description: 'Account alerts, security notifications, and updates' },
  { value: 'delivery_notifications', label: 'Delivery Notifications', description: 'Shipping updates, delivery confirmations' },
  { value: 'appointments', label: 'Appointments', description: 'Appointment reminders and scheduling' },
  { value: 'two_factor_auth', label: '2FA Authentication', description: 'One-time passwords and verification codes' },
  { value: 'polling_voting', label: 'Polling & Voting', description: 'Surveys, polls, and feedback collection' },
  { value: 'charity', label: 'Charity', description: 'Non-profit fundraising and awareness campaigns' },
];

export function NewCampaignPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBrandId = searchParams.get('brandId');

  const [brands, setBrands] = useState<Brand[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sampleMessages, setSampleMessages] = useState<string[]>(['']);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      brandId: preselectedBrandId || '',
      sampleMessages: [''],
      optOutKeywords: 'STOP, UNSUBSCRIBE',
      helpKeywords: 'HELP, INFO',
      optOutMessage: 'You have been unsubscribed. Reply HELP for assistance.',
      helpMessage: 'For assistance, contact support@example.com or call 1-800-XXX-XXXX',
    },
  });

  const selectedUseCase = watch('useCase');

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    setValue('sampleMessages', sampleMessages.filter(m => m.trim()));
  }, [sampleMessages, setValue]);

  const loadBrands = async () => {
    try {
      const response = await api.getBrands();
      if (response.success && response.data) {
        setBrands(response.data.filter((b: Brand) => b.status === 'verified'));
      }
    } catch (error) {
      console.error('Failed to load brands:', error);
    }
  };

  const addSampleMessage = () => {
    if (sampleMessages.length < 5) {
      setSampleMessages([...sampleMessages, '']);
    }
  };

  const removeSampleMessage = (index: number) => {
    if (sampleMessages.length > 1) {
      setSampleMessages(sampleMessages.filter((_, i) => i !== index));
    }
  };

  const updateSampleMessage = (index: number, value: string) => {
    const updated = [...sampleMessages];
    updated[index] = value;
    setSampleMessages(updated);
  };

  const onSubmit = async (data: CampaignForm) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await api.createCampaign({
        name: data.name,
        brandId: data.brandId,
        useCase: data.useCase,
        description: data.description,
        sampleMessages: data.sampleMessages,
        messageFlow: data.messageFlow,
        optInKeywords: data.optInKeywords?.split(',').map(k => k.trim()).filter(Boolean),
        optOutKeywords: data.optOutKeywords?.split(',').map(k => k.trim()).filter(Boolean),
        helpKeywords: data.helpKeywords?.split(',').map(k => k.trim()).filter(Boolean),
        optInMessage: data.optInMessage,
        optOutMessage: data.optOutMessage,
        helpMessage: data.helpMessage,
      });

      if (response.success && response.data) {
        navigate(`/campaigns/${response.data.id}`);
      } else {
        setSubmitError(response.error || 'Failed to create campaign');
      }
    } catch (error) {
      setSubmitError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Header
        title="Create Campaign"
        subtitle="Register a new 10DLC messaging campaign"
      />

      <div className="p-6 max-w-3xl mx-auto">
        <Card variant="glass" className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-purple-600" />
              Campaign Details
            </CardTitle>
            <CardDescription>
              Configure your messaging campaign for 10DLC compliance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 rounded-xl bg-destructive/10 text-destructive flex items-center gap-2"
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  {submitError}
                </motion.div>
              )}

              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Basic Information
                </h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Campaign Name *</label>
                  <Input
                    {...register('name')}
                    placeholder="My Marketing Campaign"
                    error={errors.name?.message}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Brand *</label>
                  <select
                    {...register('brandId')}
                    className="w-full h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                    <option value="">Select a verified brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.legalName}
                      </option>
                    ))}
                  </select>
                  {errors.brandId && (
                    <p className="text-sm text-destructive">{errors.brandId.message}</p>
                  )}
                  {brands.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No verified brands available.{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/brands/new')}
                        className="text-primary hover:underline"
                      >
                        Register a brand first
                      </button>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Use Case *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {useCases.map((uc) => (
                      <label
                        key={uc.value}
                        className={`
                          relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all
                          ${selectedUseCase === uc.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          {...register('useCase')}
                          value={uc.value}
                          className="sr-only"
                        />
                        <span className="font-medium text-sm">{uc.label}</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          {uc.description}
                        </span>
                        {selectedUseCase === uc.value && (
                          <div className="absolute top-2 right-2">
                            <Check className="h-4 w-4 text-purple-600" />
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                  {errors.useCase && (
                    <p className="text-sm text-destructive">{errors.useCase.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Campaign Description *</label>
                  <textarea
                    {...register('description')}
                    placeholder="Describe what this campaign will be used for and how subscribers opt-in..."
                    className="w-full min-h-[100px] px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description.message}</p>
                  )}
                </div>
              </div>

              {/* Sample Messages */}
              <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Sample Messages
                </h3>
                <p className="text-sm text-muted-foreground">
                  Provide examples of messages you'll send. Include opt-out language.
                </p>

                <div className="space-y-3">
                  {sampleMessages.map((message, index) => (
                    <div key={index} className="flex gap-2">
                      <textarea
                        value={message}
                        onChange={(e) => updateSampleMessage(index, e.target.value)}
                        placeholder={`Sample message ${index + 1}... (e.g., "Hi {name}, your order is ready! Reply STOP to unsubscribe.")`}
                        className="flex-1 min-h-[80px] px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                      />
                      {sampleMessages.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSampleMessage(index)}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {sampleMessages.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSampleMessage}
                  >
                    + Add Another Sample
                  </Button>
                )}
                {errors.sampleMessages && (
                  <p className="text-sm text-destructive">{errors.sampleMessages.message}</p>
                )}
              </div>

              {/* Compliance Settings */}
              <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold">Compliance Settings</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Opt-Out Keywords</label>
                    <Input
                      {...register('optOutKeywords')}
                      placeholder="STOP, UNSUBSCRIBE, CANCEL"
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Help Keywords</label>
                    <Input
                      {...register('helpKeywords')}
                      placeholder="HELP, INFO"
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Opt-Out Response Message</label>
                  <Input
                    {...register('optOutMessage')}
                    placeholder="You have been unsubscribed. Reply HELP for assistance."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Help Response Message</label>
                  <Input
                    {...register('helpMessage')}
                    placeholder="For assistance, contact support@example.com"
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                  10DLC Compliance Tips
                </h4>
                <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                  <li>• Always include opt-out instructions in promotional messages</li>
                  <li>• Sample messages should represent actual content you'll send</li>
                  <li>• Campaign approval typically takes 1-5 business days</li>
                  <li>• Higher trust scores result in better throughput limits</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/campaigns')}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  disabled={brands.length === 0}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Create Campaign
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
