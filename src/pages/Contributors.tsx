import { motion } from 'framer-motion';
import { ExternalLink, Github } from 'lucide-react';
import { contributorsData } from '../data/contributorsData';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 }
};

const Contributors = () => {
  return (
    <div className="container mx-auto px-4 md:px-12 py-16 md:py-24 max-w-7xl pt-32">
      
      <div className="text-center max-w-3xl mx-auto mb-20">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-bebas uppercase tracking-widest text-white mb-6"
        >
          Active Operatives
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-gray-500 font-mono text-sm leading-loose uppercase tracking-[0.1em]"
        >
          Classified registry of all members within the OSC-VITAP GitHub organization making active open-source contributions.
        </motion.p>
      </div>

      <section className="mb-24">
        <div className="flex justify-between items-end mb-12 border-b border-dark-700 pb-6">
          <h2 className="text-4xl font-bebas uppercase tracking-widest text-white flex items-center gap-4">
            <Github className="text-brand-accent" size={36} /> Core Contributors
          </h2>
          <span className="text-gray-500 font-mono text-xs uppercase tracking-[0.1em]">{contributorsData.length} records found</span>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6"
        >
          {contributorsData.map((member, i) => (
            <motion.div 
              key={i} 
              variants={itemVariants} 
              className="border border-dark-700 bg-dark-900/40 relative overflow-hidden group hover:border-brand-primary/50 transition-colors flex flex-col items-center p-6"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-dark-600 mb-4 group-hover:border-brand-accent transition-colors">
                <img 
                  src={member.avatar_url} 
                  alt={member.login} 
                  loading="lazy"
                  className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                />
              </div>
              <h3 className="text-white font-mono text-xs text-center truncate w-full mb-3">
                @{member.login}
              </h3>
              <a 
                href={member.html_url} 
                target="_blank" 
                rel="noreferrer"
                className="text-[10px] font-mono uppercase tracking-[0.1em] text-gray-500 hover:text-brand-accent flex items-center gap-2 transition-colors mt-auto"
              >
                Intel <ExternalLink size={10} />
              </a>
            </motion.div>
          ))}
        </motion.div>
      </section>

    </div>
  );
};

export default Contributors;
