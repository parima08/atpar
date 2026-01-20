const faqs = [
  {
    question: 'What happens if I need more than 10 databases?',
    answer: "You can disconnect tables anytime. If you consistently need more, we'll figure it out—no gotchas.",
  },
  {
    question: 'How often does it sync?',
    answer: "Every few minutes. Not real-time, but fast enough that you won't notice lag.",
  },
  {
    question: 'Do you support enterprise security features?',
    answer: "Not today. Atpar is built for small teams who want simplicity over compliance checklists. If you need SOC 2 and SSO, we're probably not the right fit yet.",
  },
  {
    question: 'What if something conflicts?',
    answer: 'Most recent edit wins. Atpar logs everything so you can see what changed and when.',
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-24 pb-32 px-4 md:px-8 scroll-mt-20 bg-gradient-to-b from-white to-[#FAFAF7]">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0D7377] bg-[#E6F4F4] px-3 py-1 rounded-full border border-[#0D7377]/15 mb-4">
            FAQ
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-tight tracking-tight">
            Frequently asked questions
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-[900px] mx-auto">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="p-6 bg-white rounded-2xl border border-[#E7E5E4] shadow-sm hover:shadow-md hover:shadow-[#0D7377]/10 transition-all"
            >
              <h3 className="text-base font-semibold text-[#1C1917] mb-2">
                {faq.question}
              </h3>
              <p className="text-[0.95rem] text-[#57534E]">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
