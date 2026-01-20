'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCcw, ArrowRight, ArrowLeft, ArrowLeftRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';

type SyncDirection = 'both' | 'notion-to-ado' | 'ado-to-notion';

interface SyncResult {
  created: number;
  updated: number;
  updatedInNotion: number;
  skipped: number;
  errorCount: number;
}

export function RunSyncSection() {
  const [direction, setDirection] = useState<SyncDirection>('both');
  const [dryRun, setDryRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSync = async () => {
    setIsRunning(true);
    setResult(null);
    setLogs([]);
    setError(null);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, dryRun }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      setResult(data.result);
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRunning(false);
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
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  direction === option.value
                    ? 'border-[#0D7377] bg-[#E6F4F4]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
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
                className="w-4 h-4 rounded border-gray-300 text-[#0D7377] focus:ring-[#0D7377]"
              />
              <span className="text-sm">Dry Run</span>
              <span className="text-xs text-gray-500">(Preview changes without making them)</span>
            </label>
          </div>

          <div className="mt-6">
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
          </div>
        </CardContent>
      </Card>

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

      {/* Results */}
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

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap">
                {logs.join('\n')}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
