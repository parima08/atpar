'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface SyncHistoryItem {
  id: number;
  direction: string;
  dryRun: boolean;
  created: number;
  updated: number;
  updatedInNotion: number;
  skipped: number;
  errorCount: number;
  errors: Array<{ notionId: string; title: string; error: string }>;
  logs: string[];
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'completed' | 'failed';
}

export function SyncHistorySection() {
  const [history, setHistory] = useState<SyncHistoryItem[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/sync/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDirectionLabel = (direction: string) => {
    switch (direction) {
      case 'both':
        return 'Bidirectional';
      case 'notion-to-ado':
        return 'Notion → ADO';
      case 'ado-to-notion':
        return 'ADO → Notion';
      default:
        return direction;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Clock className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">No sync history yet. Run a sync to see results here.</p>
          </CardContent>
        </Card>
      ) : (
        history.map((item) => (
          <Card key={item.id} className={item.status === 'failed' ? 'border-red-200' : ''}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(item.status)}
                  <div>
                    <CardTitle className="text-base">
                      {getDirectionLabel(item.direction)}
                      {item.dryRun && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                          Dry Run
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>{formatDate(item.startedAt)}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">+{item.created}</span>
                    <span className="text-blue-600">↑{item.updated}</span>
                    <span className="text-purple-600">↓{item.updatedInNotion}</span>
                    <span className="text-gray-500">⊘{item.skipped}</span>
                    {item.errorCount > 0 && (
                      <span className="text-red-600">✕{item.errorCount}</span>
                    )}
                  </div>
                  {expandedId === item.id ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </CardHeader>

            {expandedId === item.id && (
              <CardContent>
                {/* Stats */}
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <div className="text-lg font-bold text-green-600">{item.created}</div>
                    <div className="text-xs text-green-700">Created in ADO</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <div className="text-lg font-bold text-blue-600">{item.updated}</div>
                    <div className="text-xs text-blue-700">Updated in ADO</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg text-center">
                    <div className="text-lg font-bold text-purple-600">{item.updatedInNotion}</div>
                    <div className="text-xs text-purple-700">Updated in Notion</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-lg font-bold text-gray-600">{item.skipped}</div>
                    <div className="text-xs text-gray-700">Skipped</div>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${item.errorCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className={`text-lg font-bold ${item.errorCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {item.errorCount}
                    </div>
                    <div className={`text-xs ${item.errorCount > 0 ? 'text-red-700' : 'text-gray-700'}`}>Errors</div>
                  </div>
                </div>

                {/* Errors */}
                {item.errors && item.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-red-600 mb-2">Errors</h4>
                    <div className="bg-red-50 rounded-lg p-3 space-y-2">
                      {item.errors.map((error, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{error.title}:</span>{' '}
                          <span className="text-red-700">{error.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logs */}
                {item.logs && item.logs.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Sync Log</h4>
                    <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-gray-100 font-mono whitespace-pre-wrap">
                        {item.logs.join('\n')}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Timing */}
                <div className="mt-4 text-xs text-gray-500">
                  Started: {formatDate(item.startedAt)}
                  {item.completedAt && ` • Completed: ${formatDate(item.completedAt)}`}
                </div>
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
