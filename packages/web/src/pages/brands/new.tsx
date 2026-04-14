import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  User,
  MapPin,
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const brandSchema = z.object({
  // Step 1: Business Information
  legalName: z.string().min(1, 'Legal business name is required'),
  dba: z.string().optional(),
  ein: z.string().regex(/^\d{2}-?\d{7}$/, 'Invalid EIN format (XX-XXXXXXX)'),
  vertical: z.string().min(1, 'Business vertical is required'),

  // Step 2: Contact Information
  contactFirstName: z.string().min(1, 'First name is required'),
  contactLastName: z.string().min(1, 'Last name is required'),
  contactEmail: z.string().email('Valid email is required'),
  contactPhone: z.string().min(10, 'Valid phone number is required'),

  // Step 3: Address
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().min(5, 'Postal code is required'),
  country: z.string().default('US'),

  // Step 4: Brand Details
  website: z.string().url('Valid URL is required').optional().or(z.literal('')),
  description: z.string().min(20, 'Description must be at least 20 characters'),
});

type BrandForm = z.infer<typeof brandSchema>;

const steps = [
  { id: 1, title: 'Business Info', icon: Building2 },
  { id: 2, title: 'Contact', icon: User },
  { id: 3, title: 'Address', icon: MapPin },
  { id: 4, title: 'Details', icon: FileText },
];

const verticals = [
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'retail', label: 'Retail' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'technology', label: 'Technology' },
  { value: 'education', label: 'Education' },
  { value: 'nonprofit', label: 'Non-Profit' },
  { value: 'other', label: 'Other' },
];

export function NewBrandPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<BrandForm>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      country: 'US',
    },
  });

  const getStepFields = (step: number): (keyof BrandForm)[] => {
    switch (step) {
      case 1:
        return ['legalName', 'dba', 'ein', 'vertical'];
      case 2:
        return ['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone'];
      case 3:
        return ['street', 'city', 'state', 'postalCode', 'country'];
      case 4:
        return ['website', 'description'];
      default:
        return [];
    }
  };

  const handleNext = async () => {
    const fields = getStepFields(currentStep);
    const isValid = await trigger(fields);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const onSubmit = async (data: BrandForm) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await api.createBrand({
        legalName: data.legalName,
        dba: data.dba || undefined,
        ein: data.ein.replace('-', ''),
        vertical: data.vertical,
        contactFirstName: data.contactFirstName,
        contactLastName: data.contactLastName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: {
          street: data.street,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
        },
        website: data.website || undefined,
        description: data.description,
      });

      if (response.success && response.data) {
        navigate(`/brands/${response.data.id}`);
      } else {
        setSubmitError(response.error?.message || 'Failed to create brand');
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
        title="Register Brand"
        subtitle="Register your business for 10DLC messaging"
      />

      <div className="p-6 max-w-3xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const StepIcon = step.icon;

              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <motion.div
                      className={`
                        flex items-center justify-center w-12 h-12 rounded-xl border-2 transition-all duration-300
                        ${isCompleted ? 'bg-green-500 border-green-500' : ''}
                        ${isActive ? 'bg-blue-500 border-blue-500' : ''}
                        ${!isActive && !isCompleted ? 'bg-transparent border-gray-300 dark:border-gray-600' : ''}
                      `}
                      animate={{ scale: isActive ? 1.1 : 1 }}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5 text-white" />
                      ) : (
                        <StepIcon
                          className={`h-5 w-5 ${
                            isActive ? 'text-white' : 'text-muted-foreground'
                          }`}
                        />
                      )}
                    </motion.div>
                    <span
                      className={`mt-2 text-sm font-medium ${
                        isActive || isCompleted
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 mt-[-1.5rem] ${
                        currentStep > step.id
                          ? 'bg-green-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Card */}
        <Card variant="glass" className="shadow-xl">
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Enter your business registration details'}
              {currentStep === 2 && 'Provide authorized contact information'}
              {currentStep === 3 && 'Enter your business address'}
              {currentStep === 4 && 'Additional brand details for registration'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-4 rounded-xl bg-destructive/10 text-destructive flex items-center gap-2"
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  {submitError}
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {/* Step 1: Business Information */}
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Legal Business Name *</label>
                      <Input
                        {...register('legalName')}
                        placeholder="Acme Corporation Inc."
                        error={errors.legalName?.message}
                        leftIcon={<Building2 className="h-4 w-4" />}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">DBA (Doing Business As)</label>
                      <Input
                        {...register('dba')}
                        placeholder="Acme Inc."
                        error={errors.dba?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">EIN (Tax ID) *</label>
                      <Input
                        {...register('ein')}
                        placeholder="XX-XXXXXXX"
                        error={errors.ein?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Business Vertical *</label>
                      <select
                        {...register('vertical')}
                        className="w-full h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      >
                        <option value="">Select a vertical</option>
                        {verticals.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                      {errors.vertical && (
                        <p className="text-sm text-destructive">{errors.vertical.message}</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Contact Information */}
                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">First Name *</label>
                        <Input
                          {...register('contactFirstName')}
                          placeholder="John"
                          error={errors.contactFirstName?.message}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Last Name *</label>
                        <Input
                          {...register('contactLastName')}
                          placeholder="Doe"
                          error={errors.contactLastName?.message}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email *</label>
                      <Input
                        {...register('contactEmail')}
                        type="email"
                        placeholder="john@acme.com"
                        error={errors.contactEmail?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Phone *</label>
                      <Input
                        {...register('contactPhone')}
                        placeholder="+1 (555) 123-4567"
                        error={errors.contactPhone?.message}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Address */}
                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Street Address *</label>
                      <Input
                        {...register('street')}
                        placeholder="123 Main Street, Suite 100"
                        error={errors.street?.message}
                        leftIcon={<MapPin className="h-4 w-4" />}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">City *</label>
                        <Input
                          {...register('city')}
                          placeholder="San Francisco"
                          error={errors.city?.message}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">State *</label>
                        <Input
                          {...register('state')}
                          placeholder="CA"
                          error={errors.state?.message}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Postal Code *</label>
                        <Input
                          {...register('postalCode')}
                          placeholder="94105"
                          error={errors.postalCode?.message}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Country</label>
                        <Input
                          {...register('country')}
                          placeholder="US"
                          error={errors.country?.message}
                          disabled
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Details */}
                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Website</label>
                      <Input
                        {...register('website')}
                        placeholder="https://acme.com"
                        error={errors.website?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Business Description *</label>
                      <textarea
                        {...register('description')}
                        placeholder="Describe your business and how you plan to use SMS messaging..."
                        className="w-full min-h-[120px] px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                      />
                      {errors.description && (
                        <p className="text-sm text-destructive">{errors.description.message}</p>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Before you submit
                      </h4>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        <li>• Ensure all information matches your official business registration</li>
                        <li>• Brand verification typically takes 1-3 business days</li>
                        <li>• You'll be notified via email once verification is complete</li>
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={currentStep === 1 ? () => navigate('/brands') : handleBack}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  {currentStep === 1 ? 'Cancel' : 'Back'}
                </Button>

                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    rightIcon={<Check className="h-4 w-4" />}
                  >
                    Submit for Verification
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
