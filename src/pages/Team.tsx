import { motion } from 'framer-motion';
import { teamData } from '../data/teamData';
import { Github, Linkedin, Instagram, Globe } from 'lucide-react';

const Team = () => {
  const tiers = ["Admins", "Track Leads", "Technical Leads", "Executive Members"] as const;

  return (
    <div className="container mx-auto px-6 md:px-12 py-24 max-w-7xl">
      
      <div className="text-left mb-20 border-b border-dark-700 pb-10">
        <h1 className="text-5xl md:text-7xl font-bebas mb-6 tracking-wider uppercase text-white glitch-text" data-text="MEET THE 2026 ROSTER">
          MEET THE 2026 ROSTER
        </h1>
        <p className="text-gray-400 font-mono text-sm max-w-2xl leading-relaxed uppercase tracking-[0.1em]">
          // The passionate individuals driving the Open Source Community forward. 
          We are developers, designers, and creators. //
        </p>
      </div>

      <div className="space-y-32">
        {tiers.map((tier) => {
          const members = teamData.filter(m => m.tier === tier);
          if (members.length === 0) return null;

          return (
            <section key={tier}>
              <h2 className="text-3xl font-bebas mb-12 flex items-center gap-4 text-white uppercase tracking-widest">
                <span className="bg-brand-primary w-4 h-4 inline-block"></span>
                {tier}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {members.map((member, i) => (
                  <motion.div 
                    key={member.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="border border-dark-700 bg-dark-900/40 group hover:border-brand-primary/50 transition-colors flex flex-col h-full"
                  >
                    <div className="h-64 border-b border-dark-700 relative overflow-hidden bg-dark-900">
                      <div className="absolute inset-0 bg-brand-primary/10 mix-blend-overlay z-10 group-hover:opacity-0 transition-opacity"></div>
                      <img 
                        src={member.image} 
                        alt={member.name} 
                        className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-dark-900/90 border-t border-dark-700 z-20">
                        <h3 className="text-xl font-bebas text-white uppercase tracking-wider">{member.name}</h3>
                        <p className="text-brand-accent font-mono text-[10px] tracking-[0.2em] uppercase">{member.role}</p>
                      </div>
                    </div>
                    
                    <div className="p-6 flex flex-col flex-grow">
                      <p className="text-gray-400 font-mono text-xs leading-relaxed mb-6 flex-grow">
                        {member.bio}
                      </p>
                      
                      <div className="flex items-center gap-4 pt-4 border-t border-dark-700 mt-auto">
                        {member.socials.github && (
                          <a href={member.socials.github} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition-colors">
                            <Github size={16} />
                          </a>
                        )}
                        {member.socials.linkedin && (
                          <a href={member.socials.linkedin} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-brand-accent transition-colors">
                            <Linkedin size={16} />
                          </a>
                        )}
                        {member.socials.instagram && (
                          <a href={member.socials.instagram} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-pink-500 transition-colors">
                            <Instagram size={16} />
                          </a>
                        )}
                        {member.socials.website && (
                          <a href={member.socials.website} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition-colors">
                            <Globe size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

    </div>
  );
};

export default Team;
