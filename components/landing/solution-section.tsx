import { RefreshCw, Users, Settings, Link2 } from 'lucide-react';

const capabilities = [
  {
    icon: RefreshCw,
    title: 'Work items & tasks',
    description: 'Create in either tool, shows up in both.',
  },
  {
    icon: Users,
    title: 'Status & assignees',
    description: 'State changes flow automatically.',
  },
  {
    icon: Settings,
    title: 'Custom fields',
    description: 'Map the fields that matter to your team.',
  },
  {
    icon: Link2,
    title: 'Cross-links',
    description: 'Jump between tools in one click.',
  },
];

const steps = [
  { num: '1', label: 'Connect your accounts' },
  { num: '2', label: 'Map your databases' },
  { num: '3', label: 'Work normally' },
];

export function SolutionSection() {
  return (
    <section id="how-it-works" className="py-20 px-4 md:px-8 scroll-mt-20 bg-gradient-to-b from-white via-[#FBFBF7] to-[#EEF7F8]">
      <div className="max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0D7377] bg-[#E6F4F4] px-3 py-1 rounded-full border border-[#0D7377]/15 mb-4">
            How it works
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-tight tracking-tight mb-4">
            Sync once. Stop thinking about it.
          </h2>
          <p className="text-lg text-[#57534E] max-w-[600px] mx-auto">
            Atpar keeps Azure DevOps and Notion aligned—syncing every few minutes, quietly, in the background.
          </p>
        </div>
        
        {/* Setup steps - inline */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-12 bg-white/70 backdrop-blur rounded-2xl border border-[#E7E5E4] px-6 py-4">
          {steps.map((step, index) => (
            <div key={step.num} className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-7 h-7 bg-[#0D7377] text-white rounded-full text-sm font-semibold shadow-sm shadow-[#0D7377]/30">
                {step.num}
              </span>
              <span className="text-[#1C1917] font-medium">{step.label}</span>
              {index < steps.length - 1 && (
                <span className="hidden md:block text-[#D4D4D4] ml-4">→</span>
              )}
            </div>
          ))}
        </div>
        
        {/* Capability cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {capabilities.map((item) => (
            <div 
              key={item.title}
              className="p-5 bg-white rounded-2xl border border-[#E7E5E4] hover:border-[#0D7377] hover:shadow-lg hover:shadow-[#0D7377]/15 transition-all"
            >
              <div className="w-9 h-9 rounded-full bg-[#E6F4F4] border border-[#0D7377]/20 flex items-center justify-center mb-3">
                <item.icon className="w-5 h-5 text-[#0D7377]" />
              </div>
              <h3 className="text-base font-semibold text-[#1C1917] mb-1">
                {item.title}
              </h3>
              <p className="text-sm text-[#57534E]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
        
        {/* Tagline */}
        <p className="mt-8 text-center text-[#78716C] italic">
          No scripts. No workflows to maintain. Once it&apos;s running, it just runs.
        </p>
      </div>
    </section>
  );
}
