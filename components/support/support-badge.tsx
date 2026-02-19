'use client';

import { useState } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendSupportEmail } from '@/lib/support/send-email';

export function SupportBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({
    type: null,
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitStatus({ type: null, message: '' });

    const result = await sendSupportEmail(formData);

    setIsLoading(false);

    if (result.success) {
      setSubmitStatus({
        type: 'success',
        message: result.message || 'Message sent successfully!',
      });
      setFormData({ name: '', email: '', message: '' });
      setTimeout(() => {
        setIsOpen(false);
        setSubmitStatus({ type: null, message: '' });
      }, 3000);
    } else {
      setSubmitStatus({
        type: 'error',
        message: result.error || 'Failed to send message.',
      });
    }
  };

  return (
    <>
      {/* Support Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#0D7377] hover:bg-[#0A5C5F] text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        aria-label="Open support chat"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        )}
      </button>

      {/* Support Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl border border-[#E7E5E4] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-br from-[#0D7377] to-[#0A5C5F] px-6 py-4 text-white">
            <h3 className="font-semibold">How can we help?</h3>
            <p className="text-sm text-white/80">We typically reply within 24 hours</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {submitStatus.type === 'success' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[#1C1917] font-medium">{submitStatus.message}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-[#3D3835] mb-1">
                    Name
                  </label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="h-10 rounded-lg border-[#E7E5E4] focus:border-[#0D7377] focus:ring-[#0D7377]/20"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#3D3835] mb-1">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="h-10 rounded-lg border-[#E7E5E4] focus:border-[#0D7377] focus:ring-[#0D7377]/20"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-[#3D3835] mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    placeholder="Tell us how we can help..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    rows={4}
                    maxLength={5000}
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg focus:outline-none focus:border-[#0D7377] focus:ring-2 focus:ring-[#0D7377]/20 resize-none font-sans text-sm"
                  />
                  <p className="text-xs text-[#78716C] mt-1">
                    {formData.message.length}/5000
                  </p>
                </div>

                {submitStatus.type === 'error' && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                    {submitStatus.message}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 bg-[#0D7377] hover:bg-[#0A5C5F] text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send message
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
