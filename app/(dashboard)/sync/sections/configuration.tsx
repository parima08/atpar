'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { CheckCircle, XCircle, Loader2, Save, RefreshCcw, ExternalLink, ChevronDown, ChevronUp, Database, Eye, EyeOff } from 'lucide-react';

interface NotionDatabase {
  id: string;
  title: string;
}

interface AdoProject {
  id: string;
  name: string;
}

interface Config {
  notionToken: string;
  adoPat: string;
  adoOrgUrl: string;
  adoProject: string;
  notionDatabaseIds: string[];
}

interface ConfigurationSectionProps {
  onSaveSuccess?: () => void;
}

export function ConfigurationSection({ onSaveSuccess }: ConfigurationSectionProps) {
  const [notionConnected, setNotionConnected] = useState<boolean | null>(null);
  const [adoConnected, setAdoConnected] = useState<boolean | null>(null);
  const [notionDatabases, setNotionDatabases] = useState<NotionDatabase[]>([]);
  const [adoProjects, setAdoProjects] = useState<AdoProject[]>([]);
  const [config, setConfig] = useState<Config>({
    notionToken: '',
    adoPat: '',
    adoOrgUrl: '',
    adoProject: '',
    notionDatabaseIds: ['', '', '', '', ''],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingAdo, setTestingAdo] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [notionMessage, setNotionMessage] = useState('');
  const [adoMessage, setAdoMessage] = useState('');
  const [showAdoPat, setShowAdoPat] = useState(false);
  const [showNotionToken, setShowNotionToken] = useState(false);
  
  const lastLoadedTokenRef = useRef<string>('');

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
          notionToken: data.notionToken || '',
          adoPat: data.adoPat || '',
          adoOrgUrl: data.adoOrgUrl || '',
          adoProject: data.adoProject || '',
          notionDatabaseIds: databaseIds,
        });
        
        if (data.notionToken && data.notionToken.length > 20) {
          loadNotionDatabases(data.notionToken);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadNotionDatabases = useCallback(async (token?: string) => {
    const tokenToUse = token || config.notionToken;
    
    if (!tokenToUse || tokenToUse.length < 20) return;
    if (tokenToUse === lastLoadedTokenRef.current && notionDatabases.length > 0) return;
    
    setLoadingDatabases(true);
    setNotionMessage('');
    
    try {
      const response = await fetch('/api/notion/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notionToken: tokenToUse }),
      });
      if (response.ok) {
        const data = await response.json();
        setNotionDatabases(data.databases || []);
        lastLoadedTokenRef.current = tokenToUse;
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
      setNotionMessage('Failed to load databases');
      setNotionConnected(false);
    } finally {
      setLoadingDatabases(false);
    }
  }, [config.notionToken, notionDatabases.length]);

  useEffect(() => {
    const token = config.notionToken;
    if (!token || token.length < 20) return;
    
    const timer = setTimeout(() => {
      loadNotionDatabases(token);
    }, 500);
    
    return () => clearTimeout(timer);
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
      
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          notionDatabaseIds: filteredDatabaseIds,
        }),
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

  const updateDatabaseId = (index: number, value: string) => {
    const newIds = [...config.notionDatabaseIds];
    newIds[index] = value;
    setConfig({ ...config, notionDatabaseIds: newIds });
  };

  const databaseOptions: ComboboxOption[] = notionDatabases.map(db => ({
    value: db.id,
    label: db.title,
  }));

  const ConnectionStatus = ({ connected }: { connected: boolean | null }) => {
    if (connected === null) return null;
    return connected ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Azure DevOps */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Azure DevOps</CardTitle>
                <CardDescription>Configure your ADO connection</CardDescription>
              </div>
              <ConnectionStatus connected={adoConnected} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="adoOrgUrl">Organization URL</Label>
              <Input
                id="adoOrgUrl"
                placeholder="https://dev.azure.com/your-org"
                value={config.adoOrgUrl}
                onChange={(e) => setConfig({ ...config, adoOrgUrl: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                e.g., https://dev.azure.com/mycompany
              </p>
            </div>

            <div>
              <Label htmlFor="adoPat">Personal Access Token</Label>
              <div className="relative">
                <Input
                  id="adoPat"
                  type={showAdoPat ? 'text' : 'password'}
                  placeholder="Enter your PAT"
                  value={config.adoPat}
                  onChange={(e) => setConfig({ ...config, adoPat: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAdoPat(!showAdoPat)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 z-10 cursor-pointer"
                  aria-label={showAdoPat ? "Hide password" : "Show password"}
                >
                  {showAdoPat ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Requires Work Items read/write scope
              </p>
            </div>

            <div>
              <Label htmlFor="adoProject">Project Name</Label>
              {adoProjects.length > 0 ? (
                <select
                  id="adoProject"
                  value={config.adoProject}
                  onChange={(e) => setConfig({ ...config, adoProject: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-md bg-white"
                >
                  <option value="">Select a project...</option>
                  {adoProjects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="adoProject"
                  placeholder="Project name"
                  value={config.adoProject}
                  onChange={(e) => setConfig({ ...config, adoProject: e.target.value })}
                />
              )}
            </div>

            <Button
              variant="outline"
              onClick={testAdoConnection}
              disabled={testingAdo || !config.adoPat || !config.adoOrgUrl}
              className="w-full"
            >
              {testingAdo ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCcw className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>

            {adoMessage && (
              <p className={`text-sm ${adoConnected ? 'text-green-600' : 'text-red-600'}`}>
                {adoMessage}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Notion */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Notion</CardTitle>
                <CardDescription>Configure your Notion integration</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {loadingDatabases && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <ConnectionStatus connected={notionConnected} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="notionToken">Notion Token</Label>
              <div className="relative">
                <Input
                  id="notionToken"
                  type={showNotionToken ? 'text' : 'password'}
                  placeholder="Enter your integration token"
                  value={config.notionToken}
                  onChange={(e) => setConfig({ ...config, notionToken: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNotionToken(!showNotionToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 z-10 cursor-pointer"
                  aria-label={showNotionToken ? "Hide token" : "Show token"}
                >
                  {showNotionToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-xs text-[#0D7377] hover:text-[#0A5A5C] mt-1 flex items-center gap-1"
              >
                {showInstructions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                How to get a Notion token
              </button>
              
              {showInstructions && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs space-y-2">
                  <p className="font-medium">To create a Notion integration:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-[#0D7377] hover:underline inline-flex items-center gap-1">notion.so/my-integrations <ExternalLink className="h-3 w-3" /></a></li>
                    <li>Click &quot;New integration&quot;</li>
                    <li>Give it a name and select the workspace</li>
                    <li>Copy the &quot;Internal Integration Token&quot;</li>
                    <li>Share your database(s) with the integration</li>
                  </ol>
                </div>
              )}
            </div>

            {notionMessage && (
              <p className={`text-sm ${notionConnected ? 'text-green-600' : 'text-red-600'}`}>
                {notionMessage}
              </p>
            )}

            {/* Database selections */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>
                  {notionDatabases.length > 0 
                    ? 'Select databases to sync (up to 5)' 
                    : 'Enter database IDs to sync (up to 5)'}
                </span>
              </div>
              
              {notionConnected && notionDatabases.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                  No shared databases found. You can manually enter database IDs below. 
                  Find the ID in your database URL: notion.so/[workspace]/[database-id]
                </p>
              )}
              
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index}>
                  <Label htmlFor={`database-${index}`} className="text-sm">
                    Database {index + 1} {index === 0 ? '(required)' : '(optional)'}
                  </Label>
                  {notionDatabases.length > 0 ? (
                    <Combobox
                      options={databaseOptions}
                      value={config.notionDatabaseIds[index] || ''}
                      onChange={(value) => updateDatabaseId(index, value)}
                      placeholder="Search databases..."
                      className="mt-1"
                    />
                  ) : (
                    <Input
                      id={`database-${index}`}
                      placeholder={
                        notionConnected 
                          ? 'Paste database ID (e.g., abc123def456...)' 
                          : 'Enter token first to load databases'
                      }
                      value={config.notionDatabaseIds[index] || ''}
                      onChange={(e) => updateDatabaseId(index, e.target.value)}
                      disabled={!notionConnected && !config.notionToken}
                      className="mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={saveConfig} disabled={isSaving} size="lg" className="bg-[#0D7377] hover:bg-[#0A5A5C]">
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Configuration
        </Button>
        {saveSuccess && (
          <span className="text-green-600 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Configuration saved!
          </span>
        )}
      </div>
    </div>
  );
}
