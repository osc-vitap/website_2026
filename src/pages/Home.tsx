import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Code, Users, Calendar, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { eventsData } from '../data/eventsData';
import { projectsData } from '../data/projectsData';

const Home = () => {
  const featuredEvents = eventsData.slice(0, 3);
  const featuredProjects = projectsData.slice(0, 3);
  const upcomingEvent = eventsData.find(e => e.isUpcoming);

  // Slideshow data
  const slides = eventsData.filter(e => !e.isUpcoming).slice(0, 4);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="w-full font-sans tracking-tight">
      
      {/* 1. Header Slideshow */}
      {slides.length > 0 && (
        <section className="relative w-full aspect-video min-h-[60vh] max-h-[90vh] overflow-hidden border-b border-dark-700 bg-black">
          <AnimatePresence mode='wait'>
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <img 
                src={slides[currentSlide].image} 
                alt={slides[currentSlide].title} 
                className="w-full h-full object-cover grayscale opacity-30 mix-blend-screen"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-dark-900/60 via-transparent to-dark-900"></div>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="mb-6 text-brand-accent text-sm tracking-[0.3em] uppercase font-bold"
                >
                  [{slides[currentSlide].sub_title}] // {slides[currentSlide].date}
                </motion.div>
                
                <h1 
                  className="text-5xl md:text-7xl mb-8 max-w-5xl text-white uppercase tracking-[0.3em] font-sans font-light"
                >
                  {slides[currentSlide].title}
                </h1>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl leading-relaxed font-mono"
                >
                  {slides[currentSlide].description}
                </motion.p>
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <Link to="/events" className="px-10 py-4 border border-brand-primary text-white uppercase tracking-[0.2em] text-sm flex items-center gap-4 bg-brand-primary/10 hover:bg-brand-primary transition-all duration-300 group">
                    Explore Events <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

          <button onClick={prevSlide} className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-4 border border-dark-600 text-gray-500 hover:text-white hover:border-brand-primary transition-colors bg-dark-900/80 z-20 hidden md:block">
            <ChevronLeft size={24} />
          </button>
          <button onClick={nextSlide} className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-4 border border-dark-600 text-gray-500 hover:text-white hover:border-brand-primary transition-colors bg-dark-900/80 z-20 hidden md:block">
            <ChevronRight size={24} />
          </button>
          
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
            {slides.map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-1.5 transition-all duration-500 ${currentSlide === i ? 'w-16 bg-brand-primary' : 'w-6 bg-dark-600 hover:bg-gray-500'}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. Upcoming Event Banner */}
      {upcomingEvent && (
        <section className="w-full bg-dark-900 border-b border-dark-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-brand-primary/5 pattern-grid opacity-20"></div>
          <div className="flex flex-col md:flex-row w-full max-w-7xl mx-auto relative z-10">
            <div className="md:w-2/5 h-80 relative border-r border-dark-700 hidden md:block p-8">
              <div className="w-full h-full border border-dark-600 overflow-hidden relative">
                <div className="absolute inset-0 bg-brand-primary/20 mix-blend-overlay z-10"></div>
                <img src={upcomingEvent.image} alt={upcomingEvent.title} className="w-full h-full object-cover grayscale opacity-70" />
              </div>
            </div>
            <div className="md:w-3/5 p-10 md:p-16 flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-brand-accent uppercase text-xs tracking-[0.2em] font-bold bg-brand-primary/10 px-3 py-1 border border-brand-primary/30">
                  // Upcoming Directive //
                </span>
                <span className="text-gray-500 font-mono text-sm">{upcomingEvent.date}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bebas text-white mb-6 uppercase tracking-wider">{upcomingEvent.title}</h2>
              <p className="text-gray-400 font-mono text-sm mb-10 max-w-2xl leading-relaxed">{upcomingEvent.description}</p>
              <div>
                <a href={upcomingEvent.url} className="inline-flex items-center gap-3 px-8 py-4 bg-brand-primary text-white font-bold uppercase tracking-[0.1em] text-sm hover:bg-brand-accent transition-colors">
                  Initiate Link <ExternalLink size={16} />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Container */}
      <div className="container mx-auto px-6 md:px-12 py-24 max-w-7xl">
        
        {/* Quick Stats */}
        <section className="mb-40">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12"
          >
            {[
              { icon: <Code size={32} />, val: '45+', label: 'Open Source Projects' },
              { icon: <Users size={32} />, val: '350+', label: 'Active Contributors' },
              { icon: <Calendar size={32} />, val: '120+', label: 'Events Hosted' }
            ].map((stat, i) => (
              <motion.div key={i} variants={itemVariants} className="border border-dark-700 p-10 flex flex-col bg-dark-900/40 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-brand-primary/10 group-hover:text-brand-primary/20 transition-colors">
                  {stat.icon}
                </div>
                <div className="text-brand-accent mb-8">
                  {stat.icon}
                </div>
                <h3 className="text-5xl font-michroma mb-3 text-white tracking-tighter">{stat.val}</h3>
                <p className="text-gray-500 font-mono uppercase tracking-[0.1em] text-xs">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Featured Events */}
        <section className="mb-40">
          <div className="flex justify-between items-end mb-12 border-b border-dark-700 pb-6">
            <h2 className="text-4xl font-bebas uppercase tracking-widest text-white">Featured Events</h2>
            <Link to="/events" className="text-gray-400 flex items-center gap-3 uppercase tracking-[0.1em] text-xs font-mono hover:text-brand-accent transition-colors">
              View All <ArrowRight size={16} />
            </Link>
          </div>
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-10"
          >
            {featuredEvents.map(event => (
              <motion.div key={event.id} variants={itemVariants} className="border border-dark-700 flex flex-col bg-dark-900/40 group hover:border-brand-primary/50 transition-colors">
                <div className="h-56 border-b border-dark-700 p-3 relative overflow-hidden">
                  <div className="absolute inset-0 bg-brand-primary/10 mix-blend-overlay z-10 group-hover:opacity-0 transition-opacity"></div>
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                </div>
                <div className="p-8 flex-grow flex flex-col">
                  <div className="text-brand-accent font-mono text-xs tracking-[0.1em] uppercase mb-4">{event.date}</div>
                  <h3 className="text-2xl font-bebas mb-4 text-white uppercase tracking-wider">{event.title}</h3>
                  <p className="text-gray-500 font-mono text-xs leading-loose mb-8 flex-grow">{event.description}</p>
                  <Link to="/events" className="inline-block border border-dark-600 text-center py-3 font-mono uppercase tracking-[0.1em] text-xs text-gray-300 bg-dark-900 hover:bg-brand-primary/10 hover:border-brand-primary transition-colors">
                    Access Intel
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Featured Projects */}
        <section className="mb-20">
          <div className="flex justify-between items-end mb-12 border-b border-dark-700 pb-6">
            <h2 className="text-4xl font-bebas uppercase tracking-widest text-white">Top Projects</h2>
            <Link to="/projects" className="text-gray-400 flex items-center gap-3 uppercase tracking-[0.1em] text-xs font-mono hover:text-brand-accent transition-colors">
              View All <ArrowRight size={16} />
            </Link>
          </div>
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-10"
          >
            {featuredProjects.map(project => (
              <motion.div key={project.id} variants={itemVariants} className="border border-dark-700 p-8 flex flex-col h-full bg-dark-900/40 hover:border-brand-primary/50 transition-colors">
                <h3 className="text-2xl font-bebas mb-4 text-white uppercase tracking-wider">{project.title}</h3>
                <p className="text-gray-500 font-mono text-xs leading-loose mb-8 flex-grow">{project.description}</p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {project.techStack.slice(0,3).map(tech => (
                    <span key={tech} className="px-3 py-1.5 border border-dark-600 bg-dark-900 font-mono text-[10px] text-gray-400 uppercase tracking-[0.1em]">
                      {tech}
                    </span>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-auto pt-6 border-t border-dark-700">
                  <div className="flex -space-x-3">
                    {project.contributors.slice(0,3).map((avatar, i) => (
                      <img key={i} src={avatar} alt="contributor" className="w-10 h-10 border border-dark-700 grayscale opacity-80" />
                    ))}
                  </div>
                  <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-[10px] font-mono uppercase tracking-[0.1em] text-brand-accent flex items-center gap-2 bg-brand-primary/10 px-3 py-2 border border-brand-primary/30 hover:bg-brand-primary hover:text-white transition-colors">
                    Repo <ExternalLink size={12} />
                  </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

      </div>
    </div>
  );
};

export default Home;
