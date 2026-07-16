import { motion } from 'framer-motion';
import { teamData } from '../data/teamData';
import { Github, Linkedin, Twitter, Globe } from 'lucide-react';

const Team = () => {
  const tiers = ["Core Leadership", "Technical Leads", "Executive Members"] as const;

  return (
    <div className="container mx-auto px-4 md:px-6 py-12">
      
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Meet the <span className="text-gradient">2026 Team</span></h1>
        <p className="text-gray-400">
          The passionate individuals driving the Open Source Community forward. 
          We are developers, designers, and creators.
        </p>
      </div>

      <div className="space-y-24">
        {tiers.map((tier) => {
          const members = teamData.filter(m => m.tier === tier);
          if (members.length === 0) return null;

          return (
            <section key={tier}>
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-4">
                <span className="bg-brand-primary w-2 h-8 rounded-full inline-block"></span>
                {tier}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {members.map((member, i) => (
                  <motion.div 
                    key={member.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card group"
                  >
                    <div className="h-48 overflow-hidden rounded-t-2xl relative">
                      <img 
                        src={member.image} 
                        alt={member.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 grayscale group-hover:grayscale-0"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-dark-900 to-transparent opacity-80"></div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-xl font-bold text-white">{member.name}</h3>
                        <p className="text-brand-accent text-sm font-medium">{member.role}</p>
                      </div>
                    </div>
                    
                    <div className="p-5 flex flex-col h-[calc(100%-12rem)]">
                      <p className="text-gray-400 text-sm mb-6 flex-grow">
                        {member.bio}
                      </p>
                      
                      <div className="flex items-center gap-3 pt-4 border-t border-dark-600">
                        {member.socials.github && (
                          <a href={member.socials.github} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors">
                            <Github size={18} />
                          </a>
                        )}
                        {member.socials.linkedin && (
                          <a href={member.socials.linkedin} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#0A66C2] transition-colors">
                            <Linkedin size={18} />
                          </a>
                        )}
                        {member.socials.twitter && (
                          <a href={member.socials.twitter} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#1DA1F2] transition-colors">
                            <Twitter size={18} />
                          </a>
                        )}
                        {member.socials.website && (
                          <a href={member.socials.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-brand-accent transition-colors">
                            <Globe size={18} />
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
