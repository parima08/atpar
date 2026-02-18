'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  RunSyncSection,
  ConfigurationSection,
  SyncScheduleCard,
  FieldMappingsSection,
  SyncHistorySection,
} from './sections';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Wrench, ArrowLeftRight, History, Play, RefreshCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabValue = 'run' | 'setup' | 'history';

// ── Sticky top bar ──────────────────────────────────────────────────────────

interface StickyBarProps {
  lastSyncedAt: string | null;
  isRunning: boolean;
  activeTab: TabValue;
  onRunSync: () => void;
  onTabChange: (tab: TabValue) => void;
}

function StickyBar({ lastSyncedAt, isRunning, activeTab, onRunSync, onTabChange }: StickyBarProps) {
  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#E7E5E4] bg-white/95 backdrop-blur-sm px-6 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0D7377]/10">
          <RefreshCcw className="h-4 w-4 text-[#0D7377]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1C1917] leading-tight">Notion → ADO Sync</p>
          <p className="text-xs text-[#78716C] leading-tight">
            {lastSyncedAt ? `Last synced ${formatRelative(lastSyncedAt)}` : 'Never synced'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (activeTab !== 'run') onTabChange('run');
          onRunSync();
        }}
        disabled={isRunning}
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all shrink-0',
          isRunning
            ? 'bg-[#0D7377]/50 text-white cursor-not-allowed'
            : 'bg-[#0D7377] text-white hover:bg-[#0A5A5C] shadow-sm',
        )}
      >
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current" />
        )}
        {isRunning ? 'Syncing…' : 'Run Sync'}
      </button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function SyncDashboardInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabValue | null;
  const [activeTab, setActiveTab] = useState<TabValue>(
    tabParam === 'setup' || tabParam === 'history' ? tabParam : 'run'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Schedule state — lifted here so the sticky bar save shares the same config as the card
  const [schedule, setSchedule] = useState<'manual' | 'hourly' | 'daily'>('manual');
  const [scheduleHour, setScheduleHour] = useState(8);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [syncDirection, setSyncDirection] = useState<'both' | 'notion-to-ado' | 'ado-to-notion'>('both');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleSaveSuccess, setScheduleSaveSuccess] = useState(false);
  // Track what's actually persisted in the DB (separate from unsaved edits)
  const [savedSchedule, setSavedSchedule] = useState<'manual' | 'hourly' | 'daily'>('manual');
  const [savedScheduleHour, setSavedScheduleHour] = useState(8);
  const [savedScheduleMinute, setSavedScheduleMinute] = useState(0);
  const [savedSyncDirection, setSavedSyncDirection] = useState<'both' | 'notion-to-ado' | 'ado-to-notion'>('both');

  // Ref to trigger runSync inside RunSyncSection from the sticky bar
  const runSyncRef = useRef<(() => void) | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Keep activeTab in sync when the sidebar updates the ?tab= query param
  useEffect(() => {
    if (tabParam === 'run' || tabParam === 'setup' || tabParam === 'history') {
      setActiveTab(tabParam);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [tabParam]);

  // Load last synced time and schedule from config on mount
  useEffect(() => {
    fetch('/api/sync/history')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const runs = data?.history;
        if (runs?.length > 0) {
          setLastSyncedAt(runs[0].startedAt);
        }
      })
      .catch(() => null);

    fetch('/api/config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const s = data.syncSchedule || 'manual';
        const h = typeof data.syncScheduleHour === 'number' ? data.syncScheduleHour : 8;
        const m = typeof data.syncScheduleMinute === 'number' ? data.syncScheduleMinute : 0;
        const d = data.syncDirection || 'both';
        setSchedule(s); setSavedSchedule(s);
        setScheduleHour(h); setSavedScheduleHour(h);
        setScheduleMinute(m); setSavedScheduleMinute(m);
        setSyncDirection(d); setSavedSyncDirection(d);
      })
      .catch(() => null);
  }, []);

  const saveSchedule = async () => {
    setIsSavingSchedule(true);
    setScheduleSaveSuccess(false);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncSchedule: schedule, syncScheduleHour: scheduleHour, syncScheduleMinute: scheduleMinute, syncDirection }),
      });
      if (res.ok) {
        setSavedSchedule(schedule);
        setSavedScheduleHour(scheduleHour);
        setSavedScheduleMinute(scheduleMinute);
        setSavedSyncDirection(syncDirection);
        setScheduleSaveSuccess(true);
        setTimeout(() => setScheduleSaveSuccess(false), 3000);
      }
    } catch { /* silent */ } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleRunSync = () => {
    runSyncRef.current?.();
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <StickyBar
        lastSyncedAt={lastSyncedAt}
        isRunning={isRunning}
        activeTab={activeTab}
        onRunSync={handleRunSync}
        onTabChange={setActiveTab}
      />

      <div className="max-w-5xl mx-auto px-6 py-6">
        <Tabs defaultValue="run" value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>

          {/* Tab bar */}
          <TabsList className="mb-6">
            <TabsTrigger value="run" className="flex items-center gap-2">
              <Play className="h-3.5 w-3.5" />
              Schedule &amp; Run
            </TabsTrigger>
            <TabsTrigger value="setup" className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5" />
              Setup
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Schedule & Run ── */}
          <TabsContent value="run">
            <div className="space-y-6">
              <SyncScheduleCard
                schedule={schedule}
                scheduleHour={scheduleHour}
                scheduleMinute={scheduleMinute}
                syncDirection={syncDirection}
                onScheduleChange={setSchedule}
                onHourChange={setScheduleHour}
                onMinuteChange={setScheduleMinute}
                onDirectionChange={setSyncDirection}
                onSave={saveSchedule}
                isSaving={isSavingSchedule}
                saveSuccess={scheduleSaveSuccess}
                savedSchedule={savedSchedule}
                savedScheduleHour={savedScheduleHour}
                savedScheduleMinute={savedScheduleMinute}
                savedSyncDirection={savedSyncDirection}
              />
              <div className="h-px bg-[#D6D3D1]" />
              <RunSyncSection
                onRunningChange={setIsRunning}
                onSyncComplete={(startedAt) => setLastSyncedAt(startedAt)}
                registerRunFn={(fn) => { runSyncRef.current = fn; }}
              />
            </div>
          </TabsContent>

          {/* ── Tab 2: Setup ── */}
          <TabsContent value="setup">
            <div className="space-y-8">
              <section>
                <div className="mb-5 flex items-start gap-3 border-l-4 border-[#0D7377] pl-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D7377]/10">
                    <Wrench className="h-4.5 w-4.5 text-[#0D7377]" />
                  </div>
                  <div className="pt-0.5">
                    <h2 className="text-lg font-bold text-[#1C1917]">Connections</h2>
                    <p className="text-sm text-[#57534E]">Configure your Azure DevOps and Notion connections</p>
                  </div>
                </div>
                <ConfigurationSection />
              </section>

              <div className="h-px bg-[#D6D3D1]" />

              <section>
                <div className="mb-5 flex items-start gap-3 border-l-4 border-[#0D7377] pl-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D7377]/10">
                    <ArrowLeftRight className="h-4.5 w-4.5 text-[#0D7377]" />
                  </div>
                  <div className="pt-0.5">
                    <h2 className="text-lg font-bold text-[#1C1917]">Field Mappings</h2>
                    <p className="text-sm text-[#57534E]">Map Notion statuses to Azure DevOps states</p>
                  </div>
                </div>
                <FieldMappingsSection />
              </section>
            </div>
          </TabsContent>

          {/* ── Tab 3: History ── */}
          <TabsContent value="history">
            <div className="mb-5 flex items-start gap-3 border-l-4 border-[#0D7377] pl-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D7377]/10">
                <History className="h-4.5 w-4.5 text-[#0D7377]" />
              </div>
              <div className="pt-0.5">
                <h2 className="text-lg font-bold text-[#1C1917]">Sync History</h2>
                <p className="text-sm text-[#57534E]">View past sync runs and their results</p>
              </div>
            </div>
            <SyncHistorySection />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

export default function SyncDashboard() {
  return (
    <Suspense>
      <SyncDashboardInner />
    </Suspense>
  );
}
