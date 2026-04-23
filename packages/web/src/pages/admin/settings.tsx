import { useEffect, useState } from 'react';
import {
  Key,
  Globe,
  Save,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { adminApi } from '@/stores/admin.store';
import { AdminHeader } from '@/components/layout/admin-header';
import { formatDateTime } from '@/lib/utils';
import { notify } from '@/stores/notification.store';

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  isEncrypted: boolean;
  updatedAt: string;
}

interface SignalmashDiagnostic {
  id?: string;
  createdAt?: string;
  testedAt: string;
  method: string;
  requestUrl: string;
  status: number | null;
  ok: boolean;
  responseBody: string;
}

const SETTING_LABELS: Record<string, { label: string; description: string; placeholder: string }> = {
  signalmash_api_key: {
    label: 'Signalmash API Key',
    description: 'Primary Signalmash API credential used for runtime messaging operations.',
    placeholder: 'Enter your Signalmash API key',
  },
  signalmash_api_url: {
    label: 'Signalmash API URL',
    description: 'Base URL used by the backend for Signalmash API requests.',
    placeholder: 'https://api.signalmash.com',
  },
  signalmash_webhook_secret: {
    label: 'Webhook Secret',
    description: 'Secret used to verify Signalmash webhook signatures.',
    placeholder: 'Webhook secret',
  },
  ghl_app_client_id: {
    label: 'GHL Client ID',
    description: 'GoHighLevel marketplace application client ID.',
    placeholder: 'GHL client ID',
  },
  ghl_app_client_secret: {
    label: 'GHL Client Secret',
    description: 'GoHighLevel marketplace application client secret.',
    placeholder: 'GHL client secret',
  },
  ghl_app_sso_key: {
    label: 'GHL Shared Secret',
    description: 'Shared secret used to decrypt GoHighLevel custom-page user context.',
    placeholder: 'GHL shared secret',
  },
  app_name: {
    label: 'Application Name',
    description: 'Display name used by the platform.',
    placeholder: 'Signalmash Connect',
  },
  support_email: {
    label: 'Support Email',
    description: 'Support contact shown in operational messaging and admin references.',
    placeholder: 'support@example.com',
  },
};

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<SignalmashDiagnostic | null>(null);

  const loadSettings = async () => {
    try {
      const response = await adminApi.getSettings();
      if (response.success) {
        setSettings(response.data);
        const initial: Record<string, string> = {};
        response.data.forEach((setting: Setting) => {
          initial[setting.key] = setting.value;
        });
        setEditedValues(initial);
      }
    } catch (loadError) {
      console.error('Failed to load settings:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDiagnostic = async () => {
    try {
      const response = await adminApi.getSignalmashDiagnostic();
      if (response.success) {
        setDiagnostic(response.data);
      }
    } catch (loadError) {
      console.error('Failed to load Signalmash diagnostic:', loadError);
    }
  };

  useEffect(() => {
    loadSettings();
    loadDiagnostic();
  }, []);

  const handleSave = async (key: string) => {
    setSavingKey(key);
    setError(null);
    setSuccessKey(null);

    try {
      const metadata = SETTING_LABELS[key];
      await adminApi.updateSetting(key, editedValues[key], metadata?.description);
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(null), 2500);
      notify.success('Setting saved', `${metadata?.label || key} was updated.`);
      await loadSettings();
    } catch (saveError) {
      notify.error('Unable to save setting', saveError instanceof Error ? saveError.message : 'Failed to save setting');
      setError(saveError instanceof Error ? saveError.message : 'Failed to save setting');
    } finally {
      setSavingKey(null);
    }
  };

  const isChanged = (key: string) => {
    const setting = settings.find((entry) => entry.key === key);
    if (!setting) return editedValues[key]?.trim() !== '';
    return editedValues[key] !== setting.value;
  };

  const knownKeys = Object.keys(SETTING_LABELS);
  const existingKeys = settings.map((setting) => setting.key);
  const missingKeys = knownKeys.filter((key) => !existingKeys.includes(key));

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setError(null);

    try {
      const response = await adminApi.testSignalmashConnection();
      if (response.success) {
        setDiagnostic(response.data);
        notify.success(
          response.data.ok ? 'Signalmash connection succeeded' : 'Signalmash connection failed',
          response.data.ok
            ? 'The read-only provider diagnostic completed successfully.'
            : 'Captured the latest provider response for review below.'
        );
      }
      await loadSettings();
      await loadDiagnostic();
    } catch (testError) {
      notify.error('Unable to test Signalmash connection', testError instanceof Error ? testError.message : 'Request failed');
      setError(testError instanceof Error ? testError.message : 'Failed to test Signalmash connection');
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <AdminHeader title="Runtime Settings" subtitle="Configuration stored in app settings" showBack />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Settings Registry
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Manage runtime secrets and integration configuration
              </h2>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                These values are pulled by the backend at runtime. Encrypted settings are masked in the UI
                and can be updated here without redeploying the application.
              </p>
            </div>
            <Button variant="outline" onClick={loadSettings}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-500" />
                <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  Signalmash Connectivity
                </h2>
              </div>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
                Run a read-only provider diagnostic against the live Signalmash runtime. The latest result is stored
                and visible here so upstream issues can be checked without opening the terminal.
              </p>
            </div>
            <Button onClick={handleTestConnection} isLoading={isTestingConnection}>
              <Activity className="mr-2 h-4 w-4" />
              Test Signalmash Connection
            </Button>
          </div>

          {diagnostic ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={diagnostic.ok ? 'default' : 'destructive'}>
                      {diagnostic.ok ? 'Reachable' : 'Blocked'}
                    </Badge>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {diagnostic.status !== null ? `HTTP ${diagnostic.status}` : 'No HTTP status'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{diagnostic.method} {diagnostic.requestUrl}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tested {formatDateTime(diagnostic.testedAt || diagnostic.createdAt || '')}
                  </p>
                </div>
                {!diagnostic.ok && (
                  <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Provider contract still needs confirmation
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Response Snapshot
                </p>
                <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
{diagnostic.responseBody || '(empty response)'}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No Signalmash diagnostic has been recorded yet.
            </div>
          )}
        </section>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, index) => (
              <Card key={index} className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <CardContent className="p-6">
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 w-1/4 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-10 rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {settings.map((setting) => {
                const info = SETTING_LABELS[setting.key] || {
                  label: setting.key,
                  description: setting.description || '',
                  placeholder: '',
                };

                return (
                  <Card key={setting.key} className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <CardContent className="p-6">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {setting.isEncrypted ? (
                              <Key className="h-4 w-4 text-amber-500" />
                            ) : (
                              <Globe className="h-4 w-4 text-sky-500" />
                            )}
                            <h3 className="font-semibold text-slate-950 dark:text-slate-50">{info.label}</h3>
                            {setting.isEncrypted && <Badge variant="outline">Encrypted</Badge>}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{info.description}</p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Updated {formatDateTime(setting.updatedAt)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 md:flex-row">
                        <div className="relative flex-1">
                          <Input
                            type={setting.isEncrypted && !showValues[setting.key] ? 'password' : 'text'}
                            value={editedValues[setting.key] ?? ''}
                            onChange={(e) => setEditedValues({ ...editedValues, [setting.key]: e.target.value })}
                            placeholder={info.placeholder}
                            className="border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
                          />
                          {setting.isEncrypted && (
                            <button
                              type="button"
                              onClick={() => setShowValues({ ...showValues, [setting.key]: !showValues[setting.key] })}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                            >
                              {showValues[setting.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                        <Button
                          onClick={() => handleSave(setting.key)}
                          disabled={!isChanged(setting.key) || savingKey === setting.key}
                          isLoading={savingKey === setting.key}
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {missingKeys.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Missing Settings</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  These known settings are not currently present in the database.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {missingKeys.map((key) => (
                    <Badge key={key} variant="secondary">{SETTING_LABELS[key].label}</Badge>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
