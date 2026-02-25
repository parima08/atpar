'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatabaseBrowserModal, NotionDatabaseOption } from '@/components/ui/database-browser-modal';
import { CheckCircle, XCircle, Loader2, Save, RefreshCcw, ExternalLink, ChevronDown, ChevronUp, Database, Eye, EyeOff, Link2, Unlink, Key, Building2, FolderKanban, Layers, FileType, Clock, CalendarClock, Hand, AlertCircle, Plus, X as XIcon, ArrowLeftRight, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type NotionDatabase = NotionDatabaseOption;

interface AdoProject {
  id: string;
  name: string;
  description?: string;
}

interface AdoOrganization {
  id: string;
  name: string;
  url: string;
}

interface AdoArea {
  id: number;
  path: string;
  name: string;
}

interface AdoWorkItemType {
  name: string;
  description?: string;
  color?: string;
}

interface Config {
  notionToken: string;
  adoAuthType: 'pat' | 'oauth';
  adoPat: string;
  adoOrgUrl: string;
  adoProject: string;
  adoAreaPath: string;
  adoWorkType: string;
  notionDatabaseIds: string[];
  adoOAuthConnected: boolean;
  adoOAuthUserEmail: string | null;
  userHasAdoTokens: boolean;
  syncSchedule: 'manual' | 'hourly' | 'daily';
  syncScheduleHour: number;
  syncScheduleMinute: number;
}

interface ConfigurationSectionProps {
  onSaveSuccess?: () => void;
}

// Styled native select that matches the design system
function StyledSelect({
  id,
  value,
  onChange,
  children,
  className,
}: {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className={cn(
          'w-full appearance-none rounded-lg border border-[#E7E5E4] bg-white',
          'px-3 py-2 pr-9 text-sm text-[#1C1917]',
          'focus:outline-none focus:ring-2 focus:ring-[#0D7377]/30 focus:border-[#0D7377]',
          'transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
    </div>
  );
}

// Loading placeholder for dropdowns
function DropdownLoading({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center gap-2.5 rounded-lg border border-[#E7E5E4] bg-[#FAFAF7] px-3 text-sm text-[#78716C]">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0D7377]" />
      <span>Loading {label}…</span>
    </div>
  );
}

// Connection status badge
function ConnectionBadge({ connected, message }: { connected: boolean | null; message?: string }) {
  if (connected === null) return null;
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        connected
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-red-50 text-red-700 ring-1 ring-red-200',
      )}
    >
      {connected ? (
        <CheckCircle className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {message || (connected ? 'Connected' : 'Not connected')}
    </div>
  );
}

export function ConfigurationSection({ onSaveSuccess }: ConfigurationSectionProps) {
  const [notionConnected, setNotionConnected] = useState<boolean | null>(null);
  const [adoConnected, setAdoConnected] = useState<boolean | null>(null);
  const [notionDatabases, setNotionDatabases] = useState<NotionDatabase[]>([]);
  const [adoProjects, setAdoProjects] = useState<AdoProject[]>([]);
  const [adoOrganizations, setAdoOrganizations] = useState<AdoOrganization[]>([]);
  const [adoAreas, setAdoAreas] = useState<AdoArea[]>([]);
  const [adoWorkItemTypes, setAdoWorkItemTypes] = useState<AdoWorkItemType[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingWorkTypes, setLoadingWorkTypes] = useState(false);
  const [config, setConfig] = useState<Config>({
    notionToken: '',
    adoAuthType: 'oauth',
    adoPat: '',
    adoOrgUrl: '',
    adoProject: '',
    adoAreaPath: '',
    adoWorkType: '',
    notionDatabaseIds: ['', '', '', '', ''],
    adoOAuthConnected: false,
    adoOAuthUserEmail: null,
    userHasAdoTokens: false,
    syncSchedule: 'manual',
    syncScheduleHour: 8,
    syncScheduleMinute: 0,
  });
  const [disconnectingOAuth, setDisconnectingOAuth] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingAdo, setTestingAdo] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [notionMessage, setNotionMessage] = useState('');
  const [adoMessage, setAdoMessage] = useState('');
  const [showAdoPat, setShowAdoPat] = useState(false);
  const [showNotionToken, setShowNotionToken] = useState(false);
  const [dbModalOpen, setDbModalOpen] = useState(false);

  const lastLoadedTokenRef = useRef<string>('');
  const hasLoadedDatabasesRef = useRef<boolean>(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        const databaseIds = data.notionDatabaseIds || [];
        while (databaseIds.length < 5) {
          databaseIds.push('');
        }
        setConfig({
          // Don't store masked token values - leave empty so user can enter new ones
          notionToken: '',
          adoAuthType: data.adoAuthType || 'oauth',
          adoPat: '',
          adoOrgUrl: data.adoOrgUrl || '',
          adoProject: data.adoProject || '',
          adoAreaPath: data.adoAreaPath || '',
          adoWorkType: data.adoWorkType || '',
          notionDatabaseIds: databaseIds,
          adoOAuthConnected: data.adoOAuthConnected || false,
          adoOAuthUserEmail: data.adoOAuthUserEmail || null,
          userHasAdoTokens: data.userHasAdoTokens || false,
          syncSchedule: data.syncSchedule || 'manual',
          syncScheduleHour: typeof data.syncScheduleHour === 'number' ? data.syncScheduleHour : 8,
          syncScheduleMinute: typeof data.syncScheduleMinute === 'number' ? data.syncScheduleMinute : 0,
        });

        if (data.adoOAuthConnected || data.userHasAdoTokens) {
          setAdoConnected(true);
          setAdoMessage(`Connected as ${data.adoOAuthUserEmail || 'Azure DevOps user'}`);
          loadAdoOrganizations();
        }

        // Use the boolean flag to determine if Notion is connected
        if (data.hasNotionToken) {
          setNotionConnected(true);
          loadNotionDatabases(undefined, true);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadAdoOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const response = await fetch('/api/ado/organizations');
      if (response.ok) {
        const data = await response.json();
        setAdoOrganizations(data.organizations || []);
        setAdoConnected(true);
      } else if (response.status === 401) {
        setAdoMessage('Please sign in with Microsoft to connect Azure DevOps');
      }
    } catch (error) {
      console.error('Failed to load ADO organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const loadAdoProjects = async (orgName: string) => {
    if (!orgName) return;
    setLoadingProjects(true);
    setAdoProjects([]);
    setAdoAreas([]);
    setAdoWorkItemTypes([]);
    try {
      const response = await fetch(`/api/ado/projects?org=${encodeURIComponent(orgName)}`);
      if (response.ok) {
        const data = await response.json();
        setAdoProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to load ADO projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadAdoAreas = async (orgName: string, projectName: string) => {
    if (!orgName || !projectName) return;
    setLoadingAreas(true);
    try {
      const response = await fetch(`/api/ado/areas?org=${encodeURIComponent(orgName)}&project=${encodeURIComponent(projectName)}`);
      if (response.ok) {
        const data = await response.json();
        setAdoAreas(data.areas || []);
      }
    } catch (error) {
      console.error('Failed to load ADO areas:', error);
    } finally {
      setLoadingAreas(false);
    }
  };

  const loadAdoWorkItemTypes = async (orgName: string, projectName: string) => {
    if (!orgName || !projectName) return;
    setLoadingWorkTypes(true);
    try {
      const response = await fetch(`/api/ado/work-item-types?org=${encodeURIComponent(orgName)}&project=${encodeURIComponent(projectName)}`);
      if (response.ok) {
        const data = await response.json();
        setAdoWorkItemTypes(data.workItemTypes || []);
      }
    } catch (error) {
      console.error('Failed to load ADO work item types:', error);
    } finally {
      setLoadingWorkTypes(false);
    }
  };

  const handleOrgChange = (orgUrl: string) => {
    setConfig({ ...config, adoOrgUrl: orgUrl, adoProject: '', adoAreaPath: '', adoWorkType: '' });
    const orgName = orgUrl.replace('https://dev.azure.com/', '');
    if (orgName) {
      loadAdoProjects(orgName);
    }
  };

  const handleProjectChange = (projectName: string) => {
    setConfig({ ...config, adoProject: projectName, adoAreaPath: '', adoWorkType: '' });
    const orgName = config.adoOrgUrl.replace('https://dev.azure.com/', '');
    if (orgName && projectName) {
      loadAdoAreas(orgName, projectName);
      loadAdoWorkItemTypes(orgName, projectName);
    }
  };

  useEffect(() => {
    if (config.adoOrgUrl && adoOrganizations.length > 0 && adoProjects.length === 0) {
      const orgName = config.adoOrgUrl.replace('https://dev.azure.com/', '');
      if (orgName) {
        loadAdoProjects(orgName);
      }
    }
  }, [config.adoOrgUrl, adoOrganizations.length, adoProjects.length]);

  useEffect(() => {
    if (config.adoOrgUrl && config.adoProject && adoProjects.length > 0 && adoAreas.length === 0) {
      const orgName = config.adoOrgUrl.replace('https://dev.azure.com/', '');
      if (orgName) {
        loadAdoAreas(orgName, config.adoProject);
        loadAdoWorkItemTypes(orgName, config.adoProject);
      }
    }
  }, [config.adoOrgUrl, config.adoProject, adoProjects.length, adoAreas.length]);

  const loadNotionDatabases = useCallback(async (
    token?: string,
    useSavedToken?: boolean,
    signal?: AbortSignal,
  ) => {
    const tokenToUse = token || config.notionToken;

    // If no explicit token and not using saved token, bail out
    if (!useSavedToken && (!tokenToUse || tokenToUse.length < 20)) return;
    if (tokenToUse && tokenToUse === lastLoadedTokenRef.current && hasLoadedDatabasesRef.current) return;

    setLoadingDatabases(true);
    setNotionMessage('');

    try {
      // If useSavedToken, send empty body so the API reads from the DB
      const response = await fetch('/api/notion/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useSavedToken && !tokenToUse ? {} : { notionToken: tokenToUse }),
        signal,
      });
      if (response.ok) {
        const data = await response.json();
        setNotionDatabases(data.databases || []);
        lastLoadedTokenRef.current = tokenToUse || '__saved__';
        hasLoadedDatabasesRef.current = true;
        if (data.databases?.length > 0) {
          setNotionConnected(true);
          setNotionMessage(`Found ${data.databases.length} database${data.databases.length === 1 ? '' : 's'}`);
        } else {
          setNotionConnected(true);
          setNotionMessage('No databases found. Make sure to share databases with your integration.');
        }
      } else {
        const error = await response.json();
        setNotionMessage(error.error || 'Failed to load databases');
        setNotionConnected(false);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setNotionMessage('Failed to load databases');
      setNotionConnected(false);
    } finally {
      setLoadingDatabases(false);
    }
  }, [config.notionToken]);

  useEffect(() => {
    const token = config.notionToken;
    // Reset the loaded guard when the token changes so we fetch fresh results
    hasLoadedDatabasesRef.current = false;
    if (!token || token.length < 20) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadNotionDatabases(token, false, controller.signal);
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [config.notionToken, loadNotionDatabases]);

  const testAdoConnection = async () => {
    setTestingAdo(true);
    setAdoMessage('');
    try {
      const response = await fetch('/api/ado/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adoPat: config.adoPat,
          adoOrgUrl: config.adoOrgUrl,
        }),
      });
      const data = await response.json();
      setAdoConnected(data.success);
      setAdoMessage(data.message);

      if (data.success && data.projects) {
        setAdoProjects(data.projects);
      }
    } catch (error) {
      setAdoConnected(false);
      setAdoMessage('Connection failed');
    } finally {
      setTestingAdo(false);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const filteredDatabaseIds = config.notionDatabaseIds.filter(id => id.trim() !== '');

      const configToSave: Record<string, unknown> = {
        notionToken: config.notionToken,
        adoAuthType: config.adoAuthType,
        adoProject: config.adoProject,
        adoOrgUrl: config.adoOrgUrl,
        adoAreaPath: config.adoAreaPath,
        adoWorkType: config.adoWorkType,
        notionDatabaseIds: filteredDatabaseIds,
        syncSchedule: config.syncSchedule,
        syncScheduleHour: config.syncScheduleHour,
        syncScheduleMinute: config.syncScheduleMinute,
      };

      if (config.adoAuthType === 'pat') {
        configToSave.adoPat = config.adoPat;
      }

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave),
      });
      if (response.ok) {
        setSaveSuccess(true);
        onSaveSuccess?.();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const setSelectedDatabaseIds = (ids: string[]) => {
    // Pad to 5 slots so the rest of the save logic stays unchanged
    const padded = [...ids];
    while (padded.length < 5) padded.push('');
    setConfig({ ...config, notionDatabaseIds: padded });
  };

  const removeDatabase = (id: string) => {
    const filtered = config.notionDatabaseIds.filter(x => x && x !== id);
    const padded = [...filtered];
    while (padded.length < 5) padded.push('');
    setConfig({ ...config, notionDatabaseIds: padded });
  };

  const showAdoDropdowns =
    (config.adoAuthType === 'oauth' || config.userHasAdoTokens) &&
    (config.adoOAuthConnected || config.userHasAdoTokens);

  return (
    <div className="space-y-6">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Azure DevOps Card ── */}
        <Card className="border-[#C8C5C2] shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* ADO logo placeholder – blue square */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0078D4]/10">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#0078D4]" aria-hidden>
                    <path d="M0 17.965v-11.93L4.178 2l8.392 3.14V2.58l5.01 3.432L4.476 7.61v8.617L0 17.965zm12.57 2.456L4.476 18.03v-2.006l8.094 2.398V18.03l7.252-4.398L24 14.956v4.38l-11.43 1.085z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-lg">Azure DevOps</CardTitle>
                  <CardDescription className="text-sm mt-0.5">Connect your ADO workspace</CardDescription>
                </div>
              </div>
              {adoConnected !== null && (
                <ConnectionBadge
                  connected={adoConnected}
                  message={adoConnected ? 'Connected' : 'Not connected'}
                />
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Auth Type Toggle */}
            <div>
              <Label className="text-sm font-semibold uppercase tracking-wider text-[#78716C] mb-2.5 block">
                Connection Method
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: 'oauth' as const, icon: Link2, label: 'OAuth', sub: 'Recommended' },
                  { type: 'pat' as const, icon: Key, label: 'PAT', sub: 'Manual token' },
                ].map(({ type, icon: Icon, label, sub }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setConfig({ ...config, adoAuthType: type })}
                    className={cn(
                      'group relative flex flex-col gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150',
                      config.adoAuthType === type
                        ? 'border-[#0D7377] bg-[#E6F4F4]'
                        : 'border-[#E7E5E4] bg-white hover:border-[#0D7377]/40 hover:bg-[#E6F4F4]/40',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          'h-4 w-4 transition-colors',
                          config.adoAuthType === type ? 'text-[#0D7377]' : 'text-[#78716C]',
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          config.adoAuthType === type ? 'text-[#0D7377]' : 'text-[#1C1917]',
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    <p className="text-xs text-[#78716C]">{sub}</p>
                    {config.adoAuthType === type && (
                      <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#0D7377]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── OAuth Section ── */}
            {config.adoAuthType === 'oauth' && (
              <div className="rounded-xl border border-[#E7E5E4] bg-[#FAFAF7] p-4 space-y-3">
                {config.adoOAuthConnected ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1C1917]">Connected</p>
                        {config.adoOAuthUserEmail && (
                          <p className="text-xs text-[#57534E]">{config.adoOAuthUserEmail}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setDisconnectingOAuth(true);
                        try {
                          const response = await fetch('/api/auth/ado/disconnect', { method: 'POST' });
                          if (response.ok) {
                            setConfig({ ...config, adoOAuthConnected: false, adoOAuthUserEmail: null });
                            setAdoConnected(false);
                            setAdoMessage('');
                          }
                        } catch (error) {
                          console.error('Failed to disconnect:', error);
                        } finally {
                          setDisconnectingOAuth(false);
                        }
                      }}
                      disabled={disconnectingOAuth}
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 h-8 text-xs"
                    >
                      {disconnectingOAuth ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Disconnect account
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#57534E] leading-relaxed">
                      Connect your Azure DevOps account using secure OAuth — no tokens to manage.
                    </p>
                    <Button
                      onClick={() => { window.location.href = '/api/auth/ado'; }}
                      className="w-full bg-[#0078D4] hover:bg-[#106EBE] shadow-sm"
                      size="sm"
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Connect with Microsoft
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── PAT Section ── */}
            {config.adoAuthType === 'pat' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="adoOrgUrl" className="text-sm font-medium text-[#57534E]">
                    Organization URL
                  </Label>
                  <Input
                    id="adoOrgUrl"
                    placeholder="https://dev.azure.com/your-org"
                    value={config.adoOrgUrl}
                    onChange={(e) => setConfig({ ...config, adoOrgUrl: e.target.value })}
                    className="border-[#E7E5E4] focus-visible:ring-[#0D7377]/30 focus-visible:border-[#0D7377]"
                  />
                  <p className="text-sm text-[#78716C]">e.g., https://dev.azure.com/mycompany</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adoPat" className="text-sm font-medium text-[#57534E]">
                    Personal Access Token
                  </Label>
                  <div className="relative">
                    <Input
                      id="adoPat"
                      type={showAdoPat ? 'text' : 'password'}
                      placeholder="Enter your PAT"
                      value={config.adoPat}
                      onChange={(e) => setConfig({ ...config, adoPat: e.target.value })}
                      className="pr-10 border-[#E7E5E4] focus-visible:ring-[#0D7377]/30 focus-visible:border-[#0D7377]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdoPat(!showAdoPat)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] z-10 cursor-pointer transition-colors"
                      aria-label={showAdoPat ? 'Hide password' : 'Show password'}
                    >
                      {showAdoPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-[#78716C]">Requires Work Items read/write scope</p>
                </div>

                <Button
                  variant="outline"
                  onClick={testAdoConnection}
                  disabled={testingAdo || !config.adoPat || !config.adoOrgUrl}
                  className="w-full border-[#E7E5E4] hover:border-[#0D7377]/40 hover:bg-[#E6F4F4]/40"
                  size="sm"
                >
                  {testingAdo ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCcw className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>
            )}

            {/* ── Dynamic ADO dropdowns (OAuth) ── */}
            {showAdoDropdowns && (
              <div className="space-y-4 pt-1">
                <div className="h-px bg-[#D6D3D1]" />

                {/* Organization */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#57534E] flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#78716C]" />
                    Organization
                  </Label>
                  {loadingOrgs ? (
                    <DropdownLoading label="organizations" />
                  ) : adoOrganizations.length > 0 ? (
                    <StyledSelect
                      id="adoOrg"
                      value={config.adoOrgUrl}
                      onChange={(e) => handleOrgChange(e.target.value)}
                    >
                      <option value="">Select an organization…</option>
                      {adoOrganizations.map((org) => (
                        <option key={org.id} value={org.url}>{org.name}</option>
                      ))}
                    </StyledSelect>
                  ) : (
                    <div className="space-y-1.5">
                      <Input
                        placeholder="https://dev.azure.com/your-org"
                        value={config.adoOrgUrl}
                        onChange={(e) => handleOrgChange(e.target.value)}
                        className="border-[#E7E5E4] focus-visible:ring-[#0D7377]/30 focus-visible:border-[#0D7377]"
                      />
                      <p className="text-sm text-[#78716C]">No organizations found. Enter URL manually.</p>
                    </div>
                  )}
                </div>

                {/* Project */}
                {config.adoOrgUrl && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#57534E] flex items-center gap-1.5">
                      <FolderKanban className="h-3.5 w-3.5 text-[#78716C]" />
                      Project
                    </Label>
                    {loadingProjects ? (
                      <DropdownLoading label="projects" />
                    ) : adoProjects.length > 0 ? (
                      <StyledSelect
                        id="adoProject"
                        value={config.adoProject}
                        onChange={(e) => handleProjectChange(e.target.value)}
                      >
                        <option value="">Select a project…</option>
                        {adoProjects.map((p) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </StyledSelect>
                    ) : (
                      <Input
                        placeholder="Project name"
                        value={config.adoProject}
                        onChange={(e) => handleProjectChange(e.target.value)}
                        className="border-[#E7E5E4] focus-visible:ring-[#0D7377]/30 focus-visible:border-[#0D7377]"
                      />
                    )}
                  </div>
                )}

                {/* Area Path */}
                {config.adoProject && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#57534E] flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-[#78716C]" />
                      Area Path
                    </Label>
                    {loadingAreas ? (
                      <DropdownLoading label="area paths" />
                    ) : adoAreas.length > 0 ? (
                      <StyledSelect
                        id="adoAreaPath"
                        value={config.adoAreaPath}
                        onChange={(e) => setConfig({ ...config, adoAreaPath: e.target.value })}
                      >
                        <option value="">Select an area path…</option>
                        {adoAreas.map((area) => (
                          <option key={area.id} value={area.path}>{area.path}</option>
                        ))}
                      </StyledSelect>
                    ) : (
                      <Input
                        placeholder="Area path (e.g., Project\Team)"
                        value={config.adoAreaPath}
                        onChange={(e) => setConfig({ ...config, adoAreaPath: e.target.value })}
                        className="border-[#E7E5E4] focus-visible:ring-[#0D7377]/30 focus-visible:border-[#0D7377]"
                      />
                    )}
                  </div>
                )}

                {/* Work Item Type */}
                {config.adoProject && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#57534E] flex items-center gap-1.5">
                      <FileType className="h-3.5 w-3.5 text-[#78716C]" />
                      Work Item Type
                    </Label>
                    {loadingWorkTypes ? (
                      <DropdownLoading label="work item types" />
                    ) : adoWorkItemTypes.length > 0 ? (
                      <StyledSelect
                        id="adoWorkType"
                        value={config.adoWorkType}
                        onChange={(e) => setConfig({ ...config, adoWorkType: e.target.value })}
                      >
                        <option value="">Select a work item type…</option>
                        {adoWorkItemTypes.map((type) => (
                          <option key={type.name} value={type.name}>{type.name}</option>
                        ))}
                      </StyledSelect>
                    ) : (
                      <Input
                        placeholder="Work item type (e.g., User Story, Bug)"
                        value={config.adoWorkType}
                        onChange={(e) => setConfig({ ...config, adoWorkType: e.target.value })}
                        className="border-[#E7E5E4] focus-visible:ring-[#0D7377]/30 focus-visible:border-[#0D7377]"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PAT project selection */}
            {config.adoAuthType === 'pat' && (
              <div className="space-y-1.5">
                <Label htmlFor="adoProjectPat" className="text-sm font-medium text-[#57534E]">
                  Project Name
                </Label>
                {adoProjects.length > 0 ? (
                  <StyledSelect
                    id="adoProjectPat"
                    value={config.adoProject}
                    onChange={(e) => setConfig({ ...config, adoProject: e.target.value })}
                  >
                    <option value="">Select a project…</option>
                    {adoProjects.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </StyledSelect>
                ) : (
                  <Input
                    id="adoProjectPat"
                    placeholder="Project name"
                    value={config.adoProject}
                    onChange={(e) => setConfig({ ...config, adoProject: e.target.value })}
                    className="border-[#E7E5E4] focus-visible:ring-[#0D7377]/30 focus-visible:border-[#0D7377]"
                  />
                )}
              </div>
            )}

            {adoMessage && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs',
                  adoConnected
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700',
                )}
              >
                {adoConnected ? (
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                )}
                {adoMessage}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Notion Card ── */}
        <Card className="border-[#C8C5C2] shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Notion logo */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1C1917]/5">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-lg">Notion</CardTitle>
                  <CardDescription className="text-sm mt-0.5">Connect your workspace</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {loadingDatabases && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0D7377]" />
                )}
                {notionConnected !== null && (
                  <ConnectionBadge
                    connected={notionConnected}
                    message={
                      notionConnected
                        ? notionDatabases.length > 0
                          ? `${notionDatabases.length} DB${notionDatabases.length === 1 ? '' : 's'}`
                          : 'Connected'
                        : 'Not connected'
                    }
                  />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Token input */}
            <div className="space-y-1.5">
              <Label htmlFor="notionToken" className="text-sm font-medium text-[#57534E]">
                Integration Token
              </Label>
              <div className="relative">
                <Input
                  id="notionToken"
                  type={showNotionToken ? 'text' : 'password'}
                  placeholder="secret_…"
                  value={config.notionToken}
                  onChange={(e) => setConfig({ ...config, notionToken: e.target.value })}
                  className="pr-10 border-[#E7E5E4] focus-visible:ring-[#0D7377]/30 focus-visible:border-[#0D7377] font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowNotionToken(!showNotionToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] z-10 cursor-pointer transition-colors"
                  aria-label={showNotionToken ? 'Hide token' : 'Show token'}
                >
                  {showNotionToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* How-to instructions toggle */}
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="mt-1 flex items-center gap-1 text-xs text-[#0D7377] hover:text-[#0A5A5C] transition-colors"
              >
                {showInstructions ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                How to get a Notion token
              </button>

              {showInstructions && (
                <div className="mt-2 rounded-xl border border-[#E7E5E4] bg-[#FAFAF7] p-4 text-xs space-y-2">
                  <p className="font-semibold text-[#1C1917]">Create a Notion integration:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-[#57534E]">
                    <li>
                      Go to{' '}
                      <a
                        href="https://www.notion.so/my-integrations"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0D7377] hover:underline inline-flex items-center gap-0.5"
                      >
                        notion.so/my-integrations
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </li>
                    <li>Click &quot;New integration&quot;</li>
                    <li>Give it a name and select the workspace</li>
                    <li>Copy the &quot;Internal Integration Token&quot;</li>
                    <li>Share your database(s) with the integration</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Status message */}
            {notionMessage && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs',
                  notionConnected
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700',
                )}
              >
                {notionConnected ? (
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                )}
                {notionMessage}
              </div>
            )}

            {/* Database selections */}
            <div className="space-y-3 pt-1">
              <div className="h-px bg-[#D6D3D1]" />

              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-[#78716C]" />
                <span className="text-sm font-semibold uppercase tracking-wider text-[#78716C]">
                  Databases
                  <span className="normal-case font-normal tracking-normal ml-1 text-[#78716C]">(up to 5)</span>
                </span>
              </div>

              {/* Selected database chips */}
              {(() => {
                const activeIds = config.notionDatabaseIds.filter(id => id.trim() !== '');
                return activeIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeIds.map(id => {
                      const db = notionDatabases.find(d => d.id === id);
                      const isResolving = loadingDatabases && !db;
                      return (
                        <div
                          key={id}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border pl-2.5 pr-1.5 py-1 text-xs font-medium',
                            isResolving
                              ? 'border-[#E7E5E4] bg-[#F5F5F0] text-[#A8A29E]'
                              : 'border-[#0D7377]/30 bg-[#E6F4F4] text-[#0D7377]',
                          )}
                        >
                          {isResolving ? (
                            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                          ) : db?.icon && db.iconType === 'emoji' ? (
                            <span className="text-sm leading-none">{db.icon}</span>
                          ) : (
                            <Database className="h-3 w-3 shrink-0" />
                          )}
                          <span className={cn('max-w-[140px] truncate', isResolving && 'italic')}>
                            {db?.title || (isResolving ? 'Loading…' : `${id.substring(0, 8)}…`)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDatabase(id)}
                            className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors"
                            aria-label={`Remove ${db?.title || id}`}
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null;
              })()}

              {/* Loading status message */}
              {loadingDatabases && (
                <div className="flex items-center gap-2 text-xs text-[#78716C]">
                  <Loader2 className="h-3 w-3 animate-spin text-[#0D7377] shrink-0" />
                  <span>Fetching your databases from Notion — this may take a moment…</span>
                </div>
              )}

              {/* Add databases button — always shown when token is present, disabled only at max */}
              {notionConnected && (
                <button
                  type="button"
                  onClick={() => setDbModalOpen(true)}
                  disabled={config.notionDatabaseIds.filter(id => id.trim()).length >= 5}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors w-full',
                    config.notionDatabaseIds.filter(id => id.trim()).length >= 5
                      ? 'border-[#E7E5E4] text-[#A8A29E] cursor-not-allowed'
                      : loadingDatabases
                        ? 'border-[#0D7377]/20 text-[#0D7377]/50 hover:bg-[#E6F4F4]/50 hover:border-[#0D7377]/30'
                        : 'border-[#0D7377]/40 text-[#0D7377] hover:bg-[#E6F4F4] hover:border-[#0D7377]',
                  )}
                >
                  {loadingDatabases ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {config.notionDatabaseIds.filter(id => id.trim()).length >= 5
                    ? 'Maximum databases selected'
                    : loadingDatabases
                      ? 'Loading databases…'
                      : config.notionDatabaseIds.filter(id => id.trim()).length === 0
                        ? 'Browse and select databases…'
                        : 'Add more databases…'}
                </button>
              )}

              {/* No databases found warning */}
              {notionConnected && !loadingDatabases && notionDatabases.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    No shared databases found. In Notion, open a database, click{' '}
                    <strong>•••</strong> → <strong>Add connections</strong> → select your integration.
                  </span>
                </div>
              )}

              {/* Not yet connected hint */}
              {!notionConnected && (
                <p className="text-sm text-[#A8A29E]">
                  Enter your integration token above to browse databases.
                </p>
              )}
            </div>

            {/* Database browser modal */}
            <DatabaseBrowserModal
              open={dbModalOpen}
              onClose={() => setDbModalOpen(false)}
              databases={notionDatabases}
              selectedIds={config.notionDatabaseIds.filter(id => id.trim() !== '')}
              onConfirm={setSelectedDatabaseIds}
              maxSelections={5}
              loading={loadingDatabases}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Save Button ── */}
      <div className="flex items-center gap-4">
        <Button
          onClick={saveConfig}
          disabled={isSaving}
          size="lg"
          className="bg-[#0D7377] hover:bg-[#0A5C5F] shadow-sm px-8"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Configuration
        </Button>
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle className="h-4 w-4" />
            Saved!
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SyncScheduleCard — standalone export so the
// Schedule & Run tab can render it independently
// ─────────────────────────────────────────────

type SyncDirection = 'both' | 'notion-to-ado' | 'ado-to-notion';

interface SyncScheduleCardProps {
  schedule: 'manual' | 'hourly' | 'daily';
  scheduleHour: number;
  scheduleMinute: number;
  syncDirection: SyncDirection;
  onScheduleChange: (schedule: 'manual' | 'hourly' | 'daily') => void;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  onDirectionChange: (direction: SyncDirection) => void;
  onSave: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
  // What's actually saved in the DB
  savedSchedule?: 'manual' | 'hourly' | 'daily';
  savedScheduleHour?: number;
  savedScheduleMinute?: number;
  savedSyncDirection?: SyncDirection;
}

export function SyncScheduleCard({
  schedule,
  scheduleHour,
  scheduleMinute,
  syncDirection,
  onScheduleChange,
  onHourChange,
  onMinuteChange,
  onDirectionChange,
  onSave,
  isSaving,
  saveSuccess,
  savedSchedule,
  savedScheduleHour = 8,
  savedScheduleMinute = 0,
  savedSyncDirection = 'both',
}: SyncScheduleCardProps) {
  const hasUnsavedChanges = savedSchedule !== undefined && (
    schedule !== savedSchedule ||
    scheduleHour !== savedScheduleHour ||
    scheduleMinute !== savedScheduleMinute ||
    syncDirection !== savedSyncDirection
  );

  const directionOptions: { value: SyncDirection; icon: React.ElementType; label: string; desc: string }[] = [
    { value: 'both', icon: ArrowLeftRight, label: 'Bidirectional', desc: 'Sync both ways' },
    { value: 'notion-to-ado', icon: ArrowRight, label: 'Notion → ADO', desc: 'Notion to Azure DevOps' },
    { value: 'ado-to-notion', icon: ArrowLeft, label: 'ADO → Notion', desc: 'Azure DevOps to Notion' },
  ];
  return (
    <Card className="border-[#C8C5C2] shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0D7377]/10">
              <Clock className="h-5 w-5 text-[#0D7377]" />
            </div>
            <div>
              <CardTitle className="text-lg">Automatic Schedule</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Run sync automatically on a schedule, or manually from the button above
              </CardDescription>
            </div>
          </div>
          {/* Active schedule status badge */}
          {savedSchedule && savedSchedule !== 'manual' && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {savedSchedule === 'hourly'
                ? `Hourly at :${savedScheduleMinute.toString().padStart(2, '0')} UTC`
                : `Daily at ${savedScheduleHour.toString().padStart(2, '0')}:${savedScheduleMinute.toString().padStart(2, '0')} UTC`}
            </div>
          )}
          {savedSchedule === 'manual' && (
            <div className="flex items-center gap-1.5 rounded-full bg-[#F5F5F0] px-3 py-1 text-xs font-medium text-[#78716C] shrink-0">
              Manual only
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Sync direction selector */}
        <div>
          <Label className="text-sm font-semibold uppercase tracking-wider text-[#78716C] mb-2.5 block">
            Sync Direction
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {directionOptions.map(({ value, icon: Icon, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => onDirectionChange(value)}
                className={cn(
                  'group relative flex flex-col gap-1.5 rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-150',
                  syncDirection === value
                    ? 'border-[#0D7377] bg-[#E6F4F4]'
                    : 'border-[#E7E5E4] bg-white hover:border-[#0D7377]/40 hover:bg-[#E6F4F4]/40',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4 transition-colors', syncDirection === value ? 'text-[#0D7377]' : 'text-[#78716C]')} />
                  <span className={cn('text-sm font-semibold', syncDirection === value ? 'text-[#0D7377]' : 'text-[#1C1917]')}>
                    {label}
                  </span>
                </div>
                <p className="text-xs text-[#78716C]">{desc}</p>
                {syncDirection === value && (
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#0D7377]" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-[#D6D3D1]" />

        {/* Schedule type selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: 'manual' as const, icon: Hand, label: 'Manual only', desc: 'No automatic sync' },
            { value: 'hourly' as const, icon: Clock, label: 'Hourly', desc: 'Sync every hour' },
            { value: 'daily' as const, icon: CalendarClock, label: 'Daily', desc: 'Once per day' },
          ].map(({ value, icon: Icon, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => onScheduleChange(value)}
              className={cn(
                'group relative flex flex-col gap-1.5 rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-150',
                schedule === value
                  ? 'border-[#0D7377] bg-[#E6F4F4]'
                  : 'border-[#E7E5E4] bg-white hover:border-[#0D7377]/40 hover:bg-[#E6F4F4]/40',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4 transition-colors', schedule === value ? 'text-[#0D7377]' : 'text-[#78716C]')} />
                <span className={cn('text-sm font-semibold', schedule === value ? 'text-[#0D7377]' : 'text-[#1C1917]')}>
                  {label}
                </span>
              </div>
              <p className="text-xs text-[#78716C]">{desc}</p>
              {schedule === value && (
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#0D7377]" />
              )}
            </button>
          ))}
        </div>

        {/* Time picker for hourly */}
        {schedule === 'hourly' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E7E5E4] bg-[#FAFAF7] px-4 py-3">
            <span className="text-sm font-medium text-[#1C1917]">At minute</span>
            <StyledSelect value={String(scheduleMinute)} onChange={(e) => onMinuteChange(parseInt(e.target.value, 10))} className="w-24">
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>:{m.toString().padStart(2, '0')}</option>
              ))}
            </StyledSelect>
            <span className="text-xs text-[#78716C]">of every hour (UTC)</span>
          </div>
        )}

        {/* Time picker for daily */}
        {schedule === 'daily' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E7E5E4] bg-[#FAFAF7] px-4 py-3">
            <span className="text-sm font-medium text-[#1C1917]">Time (UTC)</span>
            <StyledSelect value={String(scheduleHour)} onChange={(e) => onHourChange(parseInt(e.target.value, 10))} className="w-24">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
              ))}
            </StyledSelect>
            <StyledSelect value={String(scheduleMinute)} onChange={(e) => onMinuteChange(parseInt(e.target.value, 10))} className="w-24">
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>:{m.toString().padStart(2, '0')}</option>
              ))}
            </StyledSelect>
          </div>
        )}

        {/* Schedule summary pill */}
        {schedule !== 'manual' && (
          <div className="flex items-center gap-2.5 rounded-xl bg-[#E6F4F4] px-4 py-3 text-sm text-[#0D7377]">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="font-medium">
              {schedule === 'hourly'
                ? `Syncing every hour at :${scheduleMinute.toString().padStart(2, '0')} UTC`
                : `Syncing daily at ${scheduleHour.toString().padStart(2, '0')}:${scheduleMinute.toString().padStart(2, '0')} UTC`}
            </span>
          </div>
        )}

        {/* Save schedule button */}
        <div className="flex items-center gap-4 pt-1">
          <Button
            onClick={onSave}
            disabled={isSaving}
            size="sm"
            className={cn(
              'shadow-sm',
              hasUnsavedChanges
                ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#1C1917]'
                : 'bg-[#0D7377] hover:bg-[#0A5C5F]'
            )}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Schedule
          </Button>
          {hasUnsavedChanges && !isSaving && (
            <span className="text-xs text-[#78716C]">Unsaved changes</span>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle className="h-4 w-4" />
              Saved!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
