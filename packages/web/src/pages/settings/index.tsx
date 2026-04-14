import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Building2,
  Key,
  Bell,
  Shield,
  CreditCard,
  Save,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const organizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  email: z.string().email('Valid email is required'),
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type OrganizationForm = z.infer<typeof organizationSchema>;

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const organizationForm = useForm<OrganizationForm>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  useEffect(() => {
    loadApiKeys();
    loadOrganization();
  }, []);

  const loadApiKeys = async () => {
    try {
      const response = await api.getApiKeys();
      if (response.success && response.data) {
        setApiKeys(response.data);
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const loadOrganization = async () => {
    try {
      const response = await api.getOrganization();
      if (response.success && response.data) {
        organizationForm.reset({
          name: response.data.name,
          email: response.data.email,
        });
      }
    } catch (error) {
      console.error('Failed to load organization:', error);
    }
  };

  const handleProfileSubmit = async (data: ProfileForm) => {
    setIsSaving(true);
    try {
      await api.updateProfile(data);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (data: PasswordForm) => {
    setIsSaving(true);
    try {
      await api.changePassword(data.currentPassword, data.newPassword);
      passwordForm.reset();
    } catch (error) {
      console.error('Failed to change password:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOrganizationSubmit = async (data: OrganizationForm) => {
    setIsSaving(true);
    try {
      await api.updateOrganization(data);
    } catch (error) {
      console.error('Failed to update organization:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const response = await api.createApiKey({ name: `API Key ${apiKeys.length + 1}` });
      if (response.success && response.data) {
        setNewApiKey(response.data.key);
        loadApiKeys();
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      await api.deleteApiKey(keyId);
      loadApiKeys();
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  return (
    <div>
      <Header
        title="Settings"
        subtitle="Manage your account and preferences"
      />

      <div className="p-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <Card variant="glass">
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                          ${activeTab === tab.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }
                        `}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Content */}
          <div className="flex-1 max-w-2xl">
            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Profile Settings
                    </CardTitle>
                    <CardDescription>
                      Update your personal information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">First Name</label>
                          <Input
                            {...profileForm.register('firstName')}
                            error={profileForm.formState.errors.firstName?.message}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Last Name</label>
                          <Input
                            {...profileForm.register('lastName')}
                            error={profileForm.formState.errors.lastName?.message}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input
                          {...profileForm.register('email')}
                          type="email"
                          error={profileForm.formState.errors.email?.message}
                        />
                      </div>
                      <Button type="submit" isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                        Save Changes
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Organization Settings */}
            {activeTab === 'organization' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Organization Settings
                    </CardTitle>
                    <CardDescription>
                      Manage your organization details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={organizationForm.handleSubmit(handleOrganizationSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Organization Name</label>
                        <Input
                          {...organizationForm.register('name')}
                          error={organizationForm.formState.errors.name?.message}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Billing Email</label>
                        <Input
                          {...organizationForm.register('email')}
                          type="email"
                          error={organizationForm.formState.errors.email?.message}
                        />
                      </div>
                      <Button type="submit" isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                        Save Changes
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Change Password
                    </CardTitle>
                    <CardDescription>
                      Update your password to keep your account secure
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Current Password</label>
                        <Input
                          {...passwordForm.register('currentPassword')}
                          type="password"
                          error={passwordForm.formState.errors.currentPassword?.message}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">New Password</label>
                        <Input
                          {...passwordForm.register('newPassword')}
                          type="password"
                          error={passwordForm.formState.errors.newPassword?.message}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Confirm New Password</label>
                        <Input
                          {...passwordForm.register('confirmPassword')}
                          type="password"
                          error={passwordForm.formState.errors.confirmPassword?.message}
                        />
                      </div>
                      <Button type="submit" isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                        Update Password
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* API Keys */}
            {activeTab === 'api' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card variant="glass">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Key className="h-5 w-5" />
                          API Keys
                        </CardTitle>
                        <CardDescription>
                          Manage API keys for programmatic access
                        </CardDescription>
                      </div>
                      <Button onClick={handleCreateApiKey} leftIcon={<Key className="h-4 w-4" />}>
                        Create Key
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {newApiKey && (
                      <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                          New API Key Created
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                          Copy this key now. You won't be able to see it again.
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-2 bg-white dark:bg-gray-900 rounded font-mono text-sm">
                            {newApiKey}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(newApiKey)}
                          >
                            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    {apiKeys.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No API keys created yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {apiKeys.map((key) => (
                          <div
                            key={key.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                          >
                            <div>
                              <p className="font-medium">{key.name}</p>
                              <p className="text-sm text-muted-foreground font-mono">
                                {key.prefix}...
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {key.lastUsedAt
                                  ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                                  : 'Never used'}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteApiKey(key.id)}
                                className="text-destructive"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notification Preferences
                    </CardTitle>
                    <CardDescription>
                      Manage how you receive notifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { id: 'email_messages', label: 'Message delivery reports', desc: 'Get notified about message delivery status' },
                        { id: 'email_brand', label: 'Brand verification updates', desc: 'Get notified when brand status changes' },
                        { id: 'email_campaign', label: 'Campaign status changes', desc: 'Get notified about campaign approvals' },
                        { id: 'email_billing', label: 'Billing alerts', desc: 'Get notified about billing and usage' },
                      ].map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                          <div>
                            <p className="font-medium">{item.label}</p>
                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Billing */}
            {activeTab === 'billing' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Billing & Usage
                    </CardTitle>
                    <CardDescription>
                      Manage your subscription and view usage
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm opacity-90">Current Plan</p>
                            <p className="text-2xl font-bold">Professional</p>
                          </div>
                          <Badge className="bg-white/20 text-white">Active</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                          <p className="text-sm text-muted-foreground">Messages This Month</p>
                          <p className="text-2xl font-bold">12,450</p>
                          <p className="text-xs text-muted-foreground">of 50,000 included</p>
                        </div>
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                          <p className="text-sm text-muted-foreground">Next Billing Date</p>
                          <p className="text-2xl font-bold">Apr 15</p>
                          <p className="text-xs text-muted-foreground">$99.00/month</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline">View Invoices</Button>
                        <Button variant="outline">Update Payment Method</Button>
                      </div>
                    </div>
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
