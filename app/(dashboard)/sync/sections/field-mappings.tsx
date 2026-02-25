'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, Loader2, CheckCircle, ArrowRight } from 'lucide-react';

interface StatusMapping {
  notionStatus: string;
  adoState: string;
}

interface Config {
  statusMapping: Record<string, string>;
  reverseStatusMapping: Record<string, string>;
  assigneeMapping: Record<string, string>;
  reverseAssigneeMapping: Record<string, string>;
}

interface NotionField {
  name: string;
  type: string;
  options?: Array<{ name: string; color?: string }>;
}

interface AdoState {
  name: string;
  category: string;
}

export function FieldMappingsSection() {
  const [config, setConfig] = useState<Config>({
    statusMapping: {},
    reverseStatusMapping: {},
    assigneeMapping: {},
    reverseAssigneeMapping: {},
  });
  const [notionFields, setNotionFields] = useState<NotionField[]>([]);
  const [adoStates, setAdoStates] = useState<AdoState[]>([]);
  const [statusMappings, setStatusMappings] = useState<StatusMapping[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [databaseId, setDatabaseId] = useState('');
  const [project, setProject] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (!databaseId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/notion/fields?databaseId=${databaseId}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          setNotionFields(data.fields || []);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to load Notion fields:', error);
        }
      }
    })();
    return () => controller.abort();
  }, [databaseId]);

  useEffect(() => {
    if (!project) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/ado/states?project=${encodeURIComponent(project)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          setAdoStates(data.states || []);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to load ADO states:', error);
        }
      }
    })();
    return () => controller.abort();
  }, [project]);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig({
          statusMapping: data.statusMapping || {},
          reverseStatusMapping: data.reverseStatusMapping || {},
          assigneeMapping: data.assigneeMapping || {},
          reverseAssigneeMapping: data.reverseAssigneeMapping || {},
        });
        const dbIds = data.notionDatabaseIds || [];
        setDatabaseId(Array.isArray(dbIds) ? dbIds[0] || '' : '');
        setProject(data.adoProject || '');

        const mappings: StatusMapping[] = Object.entries(data.statusMapping || {}).map(
          ([notionStatus, adoState]) => ({
            notionStatus,
            adoState: adoState as string,
          })
        );
        setStatusMappings(mappings.length > 0 ? mappings : [{ notionStatus: '', adoState: '' }]);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const addMapping = () => {
    setStatusMappings([...statusMappings, { notionStatus: '', adoState: '' }]);
  };

  const removeMapping = (index: number) => {
    setStatusMappings(statusMappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: 'notionStatus' | 'adoState', value: string) => {
    const updated = [...statusMappings];
    updated[index][field] = value;
    setStatusMappings(updated);
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const statusMapping: Record<string, string> = {};
    const reverseStatusMapping: Record<string, string> = {};

    statusMappings.forEach(({ notionStatus, adoState }) => {
      if (notionStatus && adoState) {
        statusMapping[notionStatus] = adoState;
        if (!reverseStatusMapping[adoState]) {
          reverseStatusMapping[adoState] = notionStatus;
        }
      }
    });

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusMapping,
          reverseStatusMapping,
          assigneeMapping: config.assigneeMapping,
          reverseAssigneeMapping: config.reverseAssigneeMapping,
        }),
      });
      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const notionStatusOptions = notionFields
    .filter((f) => f.type === 'status' || f.type === 'select')
    .flatMap((f) => f.options || [])
    .map((o) => o.name);

  return (
    <div className="space-y-6">
      {/* Status Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Status Mapping</CardTitle>
          <CardDescription>
            Define how Notion statuses map to ADO states. These mappings are used for bidirectional sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500">
              <div className="col-span-5">Notion Status</div>
              <div className="col-span-1 text-center"></div>
              <div className="col-span-5">ADO State</div>
              <div className="col-span-1"></div>
            </div>

            {/* Mapping rows */}
            {statusMappings.map((mapping, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-5">
                  {notionStatusOptions.length > 0 ? (
                    <select
                      value={mapping.notionStatus}
                      onChange={(e) => updateMapping(index, 'notionStatus', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">Select status...</option>
                      {notionStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Notion status"
                      value={mapping.notionStatus}
                      onChange={(e) => updateMapping(index, 'notionStatus', e.target.value)}
                    />
                  )}
                </div>
                <div className="col-span-1 text-center">
                  <ArrowRight className="h-4 w-4 mx-auto text-gray-400" />
                </div>
                <div className="col-span-5">
                  {adoStates.length > 0 ? (
                    <select
                      value={mapping.adoState}
                      onChange={(e) => updateMapping(index, 'adoState', e.target.value)}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">Select state...</option>
                      {adoStates.map((state) => (
                        <option key={state.name} value={state.name}>
                          {state.name} ({state.category})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="ADO state"
                      value={mapping.adoState}
                      onChange={(e) => updateMapping(index, 'adoState', e.target.value)}
                    />
                  )}
                </div>
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMapping(index)}
                    disabled={statusMappings.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addMapping} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assignee Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Assignee Mapping (Optional)</CardTitle>
          <CardDescription>
            Map Notion user emails to ADO user display names. Leave empty to use emails directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Assignee mapping can be configured manually in the database or via the API.
            Most teams don&apos;t need this if user emails match between systems.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <code className="text-sm">
              {JSON.stringify(config.assigneeMapping, null, 2) || '{}'}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Reverse Mapping Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Reverse Mapping Preview</CardTitle>
          <CardDescription>
            Auto-generated mapping for ADO → Notion sync direction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-2">
              {Object.entries(
                statusMappings.reduce((acc, { notionStatus, adoState }) => {
                  if (adoState && notionStatus && !acc[adoState]) {
                    acc[adoState] = notionStatus;
                  }
                  return acc;
                }, {} as Record<string, string>)
              ).map(([adoState, notionStatus]) => (
                <div key={adoState} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{adoState}</span>
                  <ArrowRight className="h-3 w-3 text-gray-400" />
                  <span>{notionStatus}</span>
                </div>
              ))}
              {statusMappings.every(m => !m.notionStatus || !m.adoState) && (
                <p className="text-gray-500 text-sm">No mappings defined yet</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={saveConfig} disabled={isSaving} className="bg-[#0D7377] hover:bg-[#0A5A5C]">
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Mappings
        </Button>
        {saveSuccess && (
          <span className="text-green-600 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Mappings saved!
          </span>
        )}
      </div>
    </div>
  );
}
