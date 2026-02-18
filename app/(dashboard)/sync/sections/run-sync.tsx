'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCcw, ArrowRight, ArrowLeft, ArrowLeftRight, CheckCircle, XCircle, Loader2, Plus, Pencil, SkipForward, AlertCircle, FileText, Activity } from 'lucide-react';

type SyncDirection = 'both' | 'notion-to-ado' | 'ado-to-notion';

interface SyncResult {
  created: number;
  updated: number;
  updatedInNotion: number;
  skipped: number;
  errorCount: number;
}

interface SyncItemDetail {
  id: string;
  title: string;
  status: string | null;
  adoId?: string | null;
  action: 'created' | 'updated' | 'updated_in_notion' | 'skipped' | 'error';
  actionDetail?: string;
}

interface StreamedSyncMessage {
  type: 'item' | 'log' | 'progress' | 'complete' | 'error';
  item?: SyncItemDetail;
  log?: string;
  progress?: { current: number; total: number; phase: string };
  result?: SyncResult;
  error?: string;
}

const MAX_VISIBLE_ITEMS = 7;

interface RunSyncSectionProps {
  /** Called whenever the running state changes — lets the parent update the sticky bar */
  onRunningChange?: (running: boolean) => void;
  /** Called when a sync completes — passes the ISO start time so the sticky bar can show "last synced" */
  onSyncComplete?: (startedAt: string) => void;
  /** Lets the parent register a callback to trigger a sync from outside (e.g. the sticky bar button) */
  registerRunFn?: (fn: () => void) => void;
}

export function RunSyncSection({ onRunningChange, onSyncComplete, registerRunFn }: RunSyncSectionProps = {}) {
  const [direction, setDirection] = useState<SyncDirection>('both');
  const [dryRun, setDryRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [items, setItems] = useState<SyncItemDetail[]>([]);
  const [allItems, setAllItems] = useState<SyncItemDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string } | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const syncStartedAtRef = useRef<string>('');

  // Get visible items (last 7 or all)
  const visibleItems = showAllItems ? allItems : items.slice(-MAX_VISIBLE_ITEMS);

  const runSync = useCallback(async () => {
    setIsRunning(true);
    onRunningChange?.(true);
    syncStartedAtRef.current = new Date().toISOString();
    setResult(null);
    setItems([]);
    setAllItems([]);
    setError(null);
    setProgress(null);
    setShowAllItems(false);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/sync/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, dryRun }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Sync failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const message: StreamedSyncMessage = JSON.parse(line.slice(6));

              switch (message.type) {
                case 'item':
                  if (message.item) {
                    setItems(prev => [...prev, message.item!]);
                    setAllItems(prev => [...prev, message.item!]);
                  }
                  break;
                case 'progress':
                  if (message.progress) {
                    setProgress(message.progress);
                  }
                  break;
                case 'complete':
                  if (message.result) {
                    setResult(message.result);
                  }
                  break;
                case 'error':
                  setError(message.error || 'Unknown error');
                  break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Sync cancelled');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      setIsRunning(false);
      onRunningChange?.(false);
      onSyncComplete?.(syncStartedAtRef.current);
      abortControllerRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, dryRun]);

  // Register the runSync function with the parent so the sticky bar can call it
  useEffect(() => {
    registerRunFn?.(runSync);
  }, [registerRunFn, runSync]);

  const cancelSync = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const directionOptions = [
    { value: 'both', label: 'Bidirectional', icon: ArrowLeftRight, description: 'Sync both ways' },
    { value: 'notion-to-ado', label: 'Notion → ADO', icon: ArrowRight, description: 'Notion to Azure DevOps' },
    { value: 'ado-to-notion', label: 'ADO → Notion', icon: ArrowLeft, description: 'Azure DevOps to Notion' },
  ];

  return (
    <div className="space-y-6">
      {/* Sync Options */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Direction</CardTitle>
          <CardDescription>Choose which direction to sync</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {directionOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setDirection(option.value as SyncDirection)}
                disabled={isRunning}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  direction === option.value
                    ? 'border-[#0D7377] bg-[#E6F4F4]'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option.icon className={`h-6 w-6 mb-2 ${direction === option.value ? 'text-[#0D7377]' : 'text-gray-500'}`} />
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-gray-500">{option.description}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 rounded border-gray-300 text-[#0D7377] focus:ring-[#0D7377]"
              />
              <span className="text-sm">Dry Run</span>
              <span className="text-xs text-gray-500">(Preview changes without making them)</span>
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              onClick={runSync}
              disabled={isRunning}
              className="w-full md:w-auto bg-[#0D7377] hover:bg-[#0A5A5C]"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Sync...
                </>
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  {dryRun ? 'Preview Sync' : 'Start Sync'}
                </>
              )}
            </Button>
            {isRunning && (
              <Button
                onClick={cancelSync}
                variant="outline"
                size="lg"
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      {isRunning && progress && (
        <Card className="border-[#0D7377]/30 bg-[#E6F4F4]/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-[#0D7377] animate-pulse" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#0D7377]">{progress.phase}</span>
                  <span className="text-sm text-gray-600">
                    {progress.total > 0 ? `${progress.current} / ${progress.total}` : 'Loading...'}
                  </span>
                </div>
                {progress.total > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#0D7377] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Sync Failed</span>
            </div>
            <p className="mt-2 text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <CardTitle>Sync {dryRun ? 'Preview' : 'Complete'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{result.created}</div>
                <div className="text-sm text-green-700">Created in ADO</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
                <div className="text-sm text-blue-700">Updated in ADO</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">{result.updatedInNotion}</div>
                <div className="text-sm text-purple-700">Updated in Notion</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-600">{result.skipped}</div>
                <div className="text-sm text-gray-700">Skipped</div>
              </div>
              <div className={`p-4 rounded-lg text-center ${result.errorCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${result.errorCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {result.errorCount}
                </div>
                <div className={`text-sm ${result.errorCount > 0 ? 'text-red-700' : 'text-gray-700'}`}>Errors</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Items Table */}
      {(items.length > 0 || isRunning) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <Activity className="h-5 w-5 text-[#0D7377] animate-pulse" />
                ) : (
                  <FileText className="h-5 w-5 text-[#0D7377]" />
                )}
                <CardTitle>
                  {isRunning ? 'Processing Items' : 'Items Processed'} ({allItems.length})
                </CardTitle>
              </div>
              {allItems.length > MAX_VISIBLE_ITEMS && !isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllItems(!showAllItems)}
                >
                  {showAllItems ? `Show Last ${MAX_VISIBLE_ITEMS}` : `Show All ${allItems.length}`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Title</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">ADO ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Action</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 && isRunning && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Waiting for items...
                      </td>
                    </tr>
                  )}
                  {visibleItems.map((item, index) => (
                    <tr
                      key={`${item.id}-${index}`}
                      className={`border-b border-gray-100 transition-all duration-300 ${
                        item.action === 'error' ? 'bg-red-50' : ''
                      } ${index === visibleItems.length - 1 && isRunning ? 'animate-pulse bg-[#E6F4F4]/50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 line-clamp-1" title={item.title}>
                          {item.title.length > 40 ? `${item.title.substring(0, 40)}...` : item.title}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.status ? (
                          <Badge variant="outline" className="text-xs">
                            {item.status}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.adoId ? (
                          <span className="font-mono text-xs text-gray-600">#{item.adoId}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <ActionBadge action={item.action} />
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-gray-500 line-clamp-1" title={item.actionDetail}>
                          {item.actionDetail}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAllItems && allItems.length > MAX_VISIBLE_ITEMS && (
              <div className="text-center text-xs text-gray-500 mt-3 pt-3 border-t">
                Showing last {MAX_VISIBLE_ITEMS} of {allItems.length} items
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: SyncItemDetail['action'] }) {
  switch (action) {
    case 'created':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
          <Plus className="h-3 w-3" />
          Created
        </Badge>
      );
    case 'updated':
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
          <Pencil className="h-3 w-3" />
          Updated
        </Badge>
      );
    case 'updated_in_notion':
      return (
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 gap-1">
          <Pencil className="h-3 w-3" />
          Notion Updated
        </Badge>
      );
    case 'skipped':
      return (
        <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 gap-1">
          <SkipForward className="h-3 w-3" />
          Skipped
        </Badge>
      );
    case 'error':
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    default:
      return null;
  }
}
