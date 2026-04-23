import Link from "next/link";
import { FOOTER_DATA, COPYRIGHT_YEAR } from "@/lib/config";

const SocialIcon = ({ platform }) => {
  const icons = {
    Instagram: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
    ),
    Facebook: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
    ),
    Youtube: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.42a2.78 2.78 0 0 0-1.94 2C1 8.11 1 12 1 12s0 3.89.46 5.58a2.78 2.78 0 0 0 1.94 2c1.72.42 8.6.42 8.6.42s6.88 0 8.6-.42a2.78 2.78 0 0 0 1.94-2C23 15.89 23 12 23 12s0-3.89-.46-5.58z"></path><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon></svg>
    ),
    Linkedin: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
    ),
    X: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.292 19.49h2.039L6.486 3.24H4.298l13.311 17.403z"></path></svg>
    ),
    Medium: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.41-3.38 6.41s-3.38-2.87-3.38-6.41 1.51-6.41 3.38-6.41 3.38 2.87 3.38 6.41zM24 12c0 3.17-.53 5.75-1.19 5.75s-1.19-2.58-1.19-5.75.53-5.75 1.19-5.75S24 8.83 24 12z"></path></svg>
    )
  };
  return icons[platform] || null;
};

export default function Footer() {
  return (
    <footer className="w-full bg-white dark:bg-[#0b1326] border-t border-slate-200 dark:border-slate-800 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-16">
          
          {/* Popular Searches */}
          <div className="lg:col-span-5">
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 font-[family-name:var(--font-headline)]">Popular Searches</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {FOOTER_DATA.popularSearches.map((item) => (
                <Link 
                  key={item.label} 
                  href={item.href}
                  className="text-[13px] text-slate-600 dark:text-slate-400 hover:text-[#003b93] dark:hover:text-[#adc6ff] transition-colors leading-snug"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* About */}
          <div className="lg:col-span-2">
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 font-[family-name:var(--font-headline)]">About</h4>
            <div className="flex flex-col gap-3">
              {FOOTER_DATA.about.map((item) => (
                <Link 
                  key={item.label} 
                  href={item.href}
                  className="text-[13px] text-slate-600 dark:text-slate-400 hover:text-[#003b93] dark:hover:text-[#adc6ff] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Etcetera */}
          <div className="lg:col-span-2">
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 font-[family-name:var(--font-headline)]">Etcetera</h4>
            <div className="flex flex-col gap-3 mb-8">
              {FOOTER_DATA.etcetera.map((item) => (
                <Link 
                  key={item.label} 
                  href={item.href}
                  className="text-[13px] text-slate-600 dark:text-slate-400 hover:text-[#003b93] dark:hover:text-[#adc6ff] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Guest Post CTA */}
            <Link 
              href="https://www.analytixlabs.co.in/submit-a-guest-post/"
              className="group block p-4 rounded-xl border border-sky-100 dark:border-sky-900/30 bg-sky-50/50 dark:bg-sky-900/10 hover:bg-sky-100 dark:hover:bg-sky-900/20 transition-all"
            >
              <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-[#003b93] dark:group-hover:text-[#adc6ff]">
                Submit a Guest Post {">"}
              </span>
            </Link>
          </div>

          {/* Socials & Association */}
          <div className="lg:col-span-3 flex flex-col items-start lg:items-end">
            <div className="flex gap-4 mb-12">
              {FOOTER_DATA.socials.map((social) => (
                <Link 
                  key={social.platform} 
                  href={social.href}
                  className="text-slate-700 dark:text-slate-300 hover:text-[#003b93] dark:hover:text-[#adc6ff] transition-colors"
                  aria-label={social.platform}
                >
                  <SocialIcon platform={social.platform} />
                </Link>
              ))}
            </div>

            <div className="text-start lg:text-end">
              <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-4 leading-relaxed max-w-[240px]">
                Delivered in association with Edzor Centre of AI & Technological Excellence
              </p>
              
              {/* Edzor Logo Placeholder */}
              <div className="flex items-center justify-start lg:justify-end gap-3 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                <svg width="32" height="32" viewBox="0 0 40 40" className="text-[#003b93] dark:text-[#adc6ff]">
                  <path fill="currentColor" d="M20 0L37.32 10V30L20 40L2.68 30V10L20 0ZM20 4.64L7.32 12V28L20 35.36L32.68 28V12L20 4.64Z" />
                  <path fill="currentColor" d="M20 12L28 16.5V23.5L20 28L12 23.5V16.5L20 12Z" />
                </svg>
                <div className="text-left">
                  <span className="block text-xl font-black tracking-tighter text-slate-800 dark:text-slate-100 leading-none">edzor</span>
                  <span className="block text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest leading-none mt-1">Centre of AI & Tech</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            © {COPYRIGHT_YEAR} ANALYTIXLABS. ALL RIGHTS RESERVED.
          </p>
          
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_DATA.legal.map((item) => (
              <Link 
                key={item.label} 
                href={item.href}
                className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hover:text-[#003b93] dark:hover:text-[#adc6ff] transition-colors uppercase tracking-wider"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
