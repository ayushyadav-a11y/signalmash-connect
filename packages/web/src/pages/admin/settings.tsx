import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Key,
  Globe,
  Save,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { adminApi } from '@/stores/admin.store';
import { AdminHeader } from '@/components/layout/admin-header';

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  isEncrypted: boolean;
  updatedAt: string;
}

const SETTING_LABELS: Record<string, { label: string; description: string; placeholder: string }> = {
  signalmash_api_key: {
    label: 'Signalmash API Key',
    description: 'Your Signalmash API key for authentication. All GHL users will use this key.',
    placeholder: 'Enter your Signalmash API key',
  },
  signalmash_api_url: {
    label: 'Signalmash API URL',
    description: 'The base URL for Signalmash API calls.',
    placeholder: 'https://api.signalmash.com',
  },
  signalmash_webhook_secret: {
    label: 'Webhook Secret',
    description: 'Secret for verifying Signalmash webhook signatures.',
    placeholder: 'Your webhook secret',
  },
  ghl_app_client_id: {
    label: 'GHL Client ID',
    description: 'Your GoHighLevel app client ID.',
    placeholder: 'GHL client ID',
  },
  ghl_app_client_secret: {
    label: 'GHL Client Secret',
    description: 'Your GoHighLevel app client secret.',
    placeholder: 'GHL client secret',
  },
  app_name: {
    label: 'Application Name',
    description: 'The display name of your application.',
    placeholder: 'SignalMash Connect',
  },
  support_email: {
    label: 'Support Email',
    description: 'Email address for support inquiries.',
    placeholder: 'support@example.com',
  },
};

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await adminApi.getSettings();
      if (response.success) {
        setSettings(response.data);
        // Initialize edited values
        const initial: Record<string, string> = {};
        response.data.forEach((s: Setting) => {
          initial[s.key] = s.value;
        });
        setEditedValues(initial);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    setSavingKey(key);
    setError(null);
    setSuccessKey(null);

    try {
      const settingInfo = SETTING_LABELS[key];
      await adminApi.updateSetting(key, editedValues[key], settingInfo?.description);
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(null), 3000);
      loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setSavingKey(null);
    }
  };

  const handleAddSetting = async (key: string, value: string) => {
    setSavingKey(key);
    setError(null);

    try {
      const settingInfo = SETTING_LABELS[key];
      await adminApi.updateSetting(key, value, settingInfo?.description);
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(null), 3000);
      loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setting');
    } finally {
      setSavingKey(null);
    }
  };

  const isChanged = (key: string) => {
    const setting = settings.find((s) => s.key === key);
    if (!setting) return editedValues[key]?.trim() !== '';
    return editedValues[key] !== setting.value;
  };

  const allSettingKeys = Object.keys(SETTING_LABELS);
  const existingKeys = settings.map((s) => s.key);
  const missingKeys = allSettingKeys.filter((k) => !existingKeys.includes(k));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <AdminHeader title="API Settings" subtitle="Configure integrations" showBack />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
          >
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </motion.div>
        )}

        <div className="space-y-6">
          {/* Existing Settings */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-700 rounded w-1/4" />
                      <div className="h-10 bg-gray-700 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {settings.map((setting, index) => {
                const info = SETTING_LABELS[setting.key] || {
                  label: setting.key,
                  description: setting.description || '',
                  placeholder: '',
                };

                return (
                  <motion.div
                    key={setting.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-white flex items-center gap-2">
                            {setting.isEncrypted ? (
                              <Key className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <Globe className="h-4 w-4 text-blue-500" />
                            )}
                            {info.label}
                          </CardTitle>
                          {setting.isEncrypted && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                              Encrypted
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-gray-400">
                          {info.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-3">
                          <div className="flex-1 relative">
                            <Input
                              type={setting.isEncrypted && !showValues[setting.key] ? 'password' : 'text'}
                              value={editedValues[setting.key] ?? ''}
                              onChange={(e) => setEditedValues({
                                ...editedValues,
                                [setting.key]: e.target.value,
                              })}
                              placeholder={info.placeholder}
                              className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                            />
                            {setting.isEncrypted && (
                              <button
                                type="button"
                                onClick={() => setShowValues({
                                  ...showValues,
                                  [setting.key]: !showValues[setting.key],
                                })}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                              >
                                {showValues[setting.key] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                          <Button
                            onClick={() => handleSave(setting.key)}
                            disabled={!isChanged(setting.key) || savingKey === setting.key}
                            isLoading={savingKey === setting.key}
                            className={
                              successKey === setting.key
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700'
                            }
                          >
                            {successKey === setting.key ? (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Saved
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Last updated: {new Date(setting.updatedAt).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}

              {/* Add Missing Settings */}
              {missingKeys.length > 0 && (
                <div className="pt-6 border-t border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Add Settings</h3>
                  <div className="space-y-4">
                    {missingKeys.map((key) => {
                      const info = SETTING_LABELS[key];
                      return (
                        <Card key={key} className="bg-gray-800/30 border-gray-700 border-dashed">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-gray-300">{info.label}</CardTitle>
                            <CardDescription className="text-gray-500">
                              {info.description}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex gap-3">
                              <Input
                                type={key.includes('secret') || key.includes('key') ? 'password' : 'text'}
                                value={editedValues[key] ?? ''}
                                onChange={(e) => setEditedValues({
                                  ...editedValues,
                                  [key]: e.target.value,
                                })}
                                placeholder={info.placeholder}
                                className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                              />
                              <Button
                                onClick={() => handleAddSetting(key, editedValues[key] ?? '')}
                                disabled={!editedValues[key]?.trim() || savingKey === key}
                                isLoading={savingKey === key}
                                variant="outline"
                                className="border-gray-600 text-gray-300 hover:text-white"
                              >
                                Add
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Refresh Button */}
        <div className="mt-8 text-center">
          <Button
            variant="ghost"
            onClick={loadSettings}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Settings
          </Button>
        </div>
      </main>
    </div>
  );
}
