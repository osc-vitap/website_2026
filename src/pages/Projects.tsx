import { motion } from 'framer-motion';
import { projectsData } from '../data/projectsData';
import { Github, ExternalLink, Terminal } from 'lucide-react';

const Projects = () => {
  return (
    <div className="container mx-auto px-4 md:px-12 py-16 md:py-24 max-w-7xl">

      <div className="text-center max-w-2xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Open Source <span className="text-gradient">Projects</span></h1>
        <p className="text-gray-400">
          Explore the repositories built and maintained by our community members. 
          Contributions are always welcome!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {projectsData.map((project, i) => (
          <motion.div 
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 md:p-8 flex flex-col relative overflow-hidden group"
          >
            <div className="flex justify-between items-start gap-3 mb-4 relative z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-dark-800 border border-dark-600 shrink-0">
                  <Terminal className="text-brand-accent" size={20} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white min-w-0 break-words">{project.title}</h3>
              </div>
              <div className="flex gap-2 shrink-0">
                {project.liveUrl && (
                  <a href={project.liveUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white glass rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent" title="Live Demo" aria-label={`Open the ${project.title} live demo`}>
                    <ExternalLink size={18} />
                  </a>
                )}
                <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white glass rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent" title="GitHub Repo" aria-label={`Open the ${project.title} GitHub repository`}>
                  <Github size={18} />
                </a>
              </div>
            </div>
            
            <p className="text-gray-400 mb-6 flex-grow relative z-10 leading-relaxed">
              {project.description}
            </p>
            
            <div className="mb-6 relative z-10">
              <div className="flex flex-wrap gap-2">
                {project.techStack.map(tech => (
                  <span key={tech} className="px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-xs text-brand-accent font-medium">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-3 pt-6 border-t border-dark-600/50 relative z-10">
              <span className="text-sm text-gray-400 font-medium">Contributors</span>
              <div className="flex -space-x-2">
                {project.contributors.map((avatar, i) => (
                  <img
                    key={i}
                    src={avatar}
                    alt=""
                    loading="lazy"
                    width={32}
                    height={32}
                    className="w-8 h-8 shrink-0 rounded-full border-2 border-dark-800 bg-dark-700 object-cover hover:scale-110 transition-transform relative z-20"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

    </div>
  );
};

export default Projects;
