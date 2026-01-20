import Link from 'next/link';

export function Footer() {
  return (
    <footer className="py-8 px-4 md:px-8 border-t border-[#F5F5F0] bg-white">
      <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <Link 
          href="/" 
          className="font-display text-xl font-semibold text-[#0D7377] tracking-tight hover:opacity-80 transition-opacity"
        >
          atpar
        </Link>
        
        <div className="flex gap-6 md:gap-8">
          <Link 
            href="/docs" 
            className="text-sm text-[#57534E] hover:text-[#0D7377] transition-colors"
          >
            Documentation
          </Link>
          <Link 
            href="/privacy" 
            className="text-sm text-[#57534E] hover:text-[#0D7377] transition-colors"
          >
            Privacy
          </Link>
          <Link 
            href="/terms" 
            className="text-sm text-[#57534E] hover:text-[#0D7377] transition-colors"
          >
            Terms
          </Link>
          <a 
            href="mailto:hello@atpar.io" 
            className="text-sm text-[#57534E] hover:text-[#0D7377] transition-colors"
          >
            Contact
          </a>
        </div>
        
        <p className="text-sm text-[#78716C]">
          © 2025 Atpar
        </p>
      </div>
    </footer>
  );
}
