import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Github } from 'lucide-react';
import { contributorsData } from '../data/contributorsData';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://events.oscvitap.com';

export interface ContributorItem {
  id?: number;
  login: string;
  name?: string | null;
  description?: string | null;
  avatar_url: string;
  html_url: string;
  display_order?: number;
}

const Contributors = () => {
  const [contributors, setContributors] = useState<ContributorItem[]>(contributorsData);

  useEffect(() => {
    let cancelled = false;

    async function fetchContributors() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/contributors`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.contributors) && data.contributors.length > 0) {
            setContributors(data.contributors);
          }
        }
      } catch (err) {
        // Fallback to static contributorsData is already initialized
        console.warn('Using static contributors fallback due to error:', err);
      }
    }

    fetchContributors();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container mx-auto max-w-7xl px-4 pb-16 pt-24 sm:pb-20 sm:pt-28 md:px-12 md:pb-24 md:pt-32">
      
      <div className="mx-auto mb-16 max-w-3xl text-center sm:mb-20">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-4xl font-bebas uppercase tracking-[0.18em] text-white sm:text-5xl md:text-6xl md:tracking-widest"
        >
          Active Operatives
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 font-mono text-sm leading-loose uppercase tracking-[0.1em]"
        >
          Classified registry of all members within the OSC-VITAP GitHub organization making active open-source contributions.
        </motion.p>
      </div>

      <section className="mb-20 sm:mb-24">
        {/* Stacks on phones: the heading and the record count cannot share a
            row below ~640px without the heading being squeezed. */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:items-end mb-12 border-b border-dark-700 pb-6">
          <h2 className="text-3xl md:text-4xl font-bebas uppercase tracking-widest text-white flex items-center gap-4">
            <Github className="text-brand-accent flex-shrink-0" size={36} /> Core Contributors
          </h2>
          <span className="text-gray-400 font-mono text-xs uppercase tracking-[0.1em]">{contributors.length} records found</span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {contributors.map((member, i) => (
            <motion.div 
              key={member.id ?? member.login ?? i} 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3 }}
              className="border border-dark-700 bg-dark-900/40 relative overflow-hidden group hover:border-brand-primary/50 transition-all flex flex-col items-center p-4 md:p-5 rounded-lg"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-dark-600 mb-3.5 group-hover:border-brand-accent transition-colors shrink-0 bg-dark-950">
                <img 
                  src={member.avatar_url} 
                  alt={member.name || member.login} 
                  loading="lazy"
                  className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://avatars.githubusercontent.com/${encodeURIComponent(member.login)}`;
                  }}
                />
              </div>

              {/* Name & Handle */}
              {member.name ? (
                <>
                  <h3 className="text-white font-sans font-semibold text-sm text-center truncate w-full">
                    {member.name}
                  </h3>
                  <p className="text-brand-accent font-mono text-[11px] text-center truncate w-full mb-1">
                    @{member.login}
                  </p>
                </>
              ) : (
                <h3 className="text-white font-mono text-xs text-center truncate w-full mb-1 font-medium">
                  @{member.login}
                </h3>
              )}

              {/* Optional Description / Role */}
              {member.description && (
                <p className="text-gray-400 font-mono text-[10px] text-center line-clamp-2 w-full my-1.5 px-1 leading-snug">
                  {member.description}
                </p>
              )}

              {/* Profile Link */}
              <a
                href={member.html_url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${member.name || member.login} on GitHub`}
                className="text-[10px] font-mono uppercase tracking-[0.1em] text-gray-400 hover:text-brand-accent flex items-center justify-center gap-1.5 transition-colors mt-auto pt-3 px-3 min-h-[36px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              >
                Intel <ExternalLink size={10} className="flex-shrink-0" />
              </a>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
};

export default Contributors;
