export function ProblemSection() {
  return (
    <section className="py-20 px-4 md:px-8 bg-gradient-to-b from-[#FAFAF7] via-white to-[#F1F7F7] border-y border-[#F5F5F0]">
      <div className="max-w-[900px] mx-auto text-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0D7377] bg-[#E6F4F4] px-3 py-1 rounded-full border border-[#0D7377]/15 mb-5">
          The problem
        </span>
        <h2 className="font-display text-3xl md:text-4xl font-semibold leading-tight tracking-tight mb-6 text-[#1C1917]">
          Two tools. One team.<br />You&apos;re the middleware.
        </h2>
        
        <p className="text-lg text-[#57534E] mb-8 max-w-[650px] mx-auto">
          Azure DevOps is the system of record. Notion is where your team actually plans and thinks. 
          You shouldn&apos;t spend your week copying statuses between them.
        </p>
        
        <blockquote className="text-lg text-[#1C1917] leading-relaxed max-w-[700px] mx-auto px-6 py-4 bg-white/80 rounded-2xl border border-[#E7E5E4] shadow-sm shadow-[#0D7377]/10">
          &ldquo;I&apos;m an EM who runs planning in Notion because it&apos;s actually usable—but ADO is the system of record for my org. I was tired of being the human sync layer.&rdquo;
        </blockquote>
      </div>
    </section>
  );
}
