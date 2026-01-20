'use client';

import { useEffect } from 'react';
import {
  RunSyncSection,
  ConfigurationSection,
  FieldMappingsSection,
  SyncHistorySection,
} from './sections';

export default function SyncDashboard() {
  // Handle hash navigation on page load
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          const headerOffset = 20;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.scrollY - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen">
      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Run Sync Section */}
        <section id="run" className="mb-16 scroll-mt-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#1C1917]">Run Sync</h2>
            <p className="text-[#57534E] mt-1">Synchronize items between Notion and Azure DevOps</p>
          </div>
          <RunSyncSection />
        </section>

        {/* Configuration Section */}
        <section id="config" className="mb-16 scroll-mt-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#1C1917]">Configuration</h2>
            <p className="text-[#57534E] mt-1">Configure your Azure DevOps and Notion connections</p>
          </div>
          <ConfigurationSection />
        </section>

        {/* Field Mappings Section */}
        <section id="mappings" className="mb-16 scroll-mt-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#1C1917]">Field Mappings</h2>
            <p className="text-[#57534E] mt-1">Map Notion statuses to Azure DevOps states</p>
          </div>
          <FieldMappingsSection />
        </section>

        {/* Sync History Section */}
        <section id="history" className="mb-16 scroll-mt-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#1C1917]">Sync History</h2>
            <p className="text-[#57534E] mt-1">View past sync runs and their results</p>
          </div>
          <SyncHistorySection />
        </section>
      </div>
    </div>
  );
}
