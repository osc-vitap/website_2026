import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Code, Users, Calendar, ChevronLeft, ChevronRight, ExternalLink, Target, Zap, Heart, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { eventsData } from '../data/eventsData';
import { projectsData } from '../data/projectsData';
import UpcomingEvents from '../components/UpcomingEvents';

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
        <section className="relative min-h-[50vh] w-full overflow-hidden border-b border-dark-700 bg-black aspect-[4/3] max-h-[90vh] md:aspect-video">
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
                src={slides[currentSlide].carouselImage} 
                alt={slides[currentSlide].title} 
                className="w-full h-full object-cover opacity-30 mix-blend-screen"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-dark-900/60 via-transparent to-dark-900"></div>
              
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center sm:p-6 md:p-8">
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="mb-4 px-2 text-center text-xs font-bold uppercase tracking-[0.22em] text-brand-accent sm:mb-6 sm:text-sm sm:tracking-[0.3em]"
                >
                  [{slides[currentSlide].sub_title}] // {slides[currentSlide].date}
                </motion.div>
                
                <h1 
                  className="mb-5 max-w-5xl text-3xl font-light uppercase tracking-[0.16em] text-white sm:text-5xl sm:tracking-[0.2em] md:mb-8 md:text-7xl md:tracking-[0.3em]"
                >
                  {slides[currentSlide].title}
                </h1>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="mb-8 max-w-2xl px-2 font-mono text-sm leading-relaxed text-gray-400 sm:text-base md:mb-12 md:text-xl"
                >
                  {slides[currentSlide].description}
                </motion.p>
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <Link to="/events" className="group inline-flex min-h-[44px] w-full items-center justify-center gap-3 border border-brand-primary bg-brand-primary/10 px-6 py-3 text-center text-xs uppercase tracking-[0.18em] text-white transition-all duration-300 hover:bg-brand-primary sm:w-auto sm:px-10 sm:py-4 sm:text-sm sm:tracking-[0.2em]">
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
          
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-8 sm:gap-3">
            {slides.map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-1.5 transition-all duration-500 ${currentSlide === i ? 'w-10 bg-brand-primary sm:w-16' : 'w-4 bg-dark-600 hover:bg-gray-500 sm:w-6'}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. Upcoming events, live from D1 */}
      <UpcomingEvents />

      {/* Legacy hardcoded banner, kept for events that predate D1 */}
      {upcomingEvent && (
        <section className="w-full bg-dark-900 border-b border-dark-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-brand-primary/5 pattern-grid opacity-20"></div>
          <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col md:flex-row">
            <div className="md:w-2/5 h-80 relative border-r border-dark-700 hidden md:block p-8">
              <div className="w-full h-full border border-dark-600 overflow-hidden relative">
                <div className="absolute inset-0 bg-brand-primary/20 mix-blend-overlay z-10"></div>
                <img src={upcomingEvent.image} alt={upcomingEvent.title} className="w-full h-full object-cover grayscale opacity-70" />
              </div>
            </div>
            <div className="flex flex-col justify-center p-6 md:w-3/5 md:p-16">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-6">
                <span className="text-brand-accent uppercase text-xs tracking-[0.2em] font-bold bg-brand-primary/10 px-3 py-1 border border-brand-primary/30">
                  // Upcoming Directive //
                </span>
                <span className="text-gray-500 font-mono text-sm">{upcomingEvent.date}</span>
              </div>
              <h2 className="mb-6 text-3xl font-bebas uppercase tracking-wider text-white md:text-5xl">{upcomingEvent.title}</h2>
              <p className="text-gray-400 font-mono text-xs md:text-sm mb-8 md:mb-10 max-w-2xl leading-relaxed">{upcomingEvent.description}</p>
              <div>
                <a href={upcomingEvent.url} className="inline-flex min-h-[44px] w-full items-center justify-center gap-3 bg-brand-primary px-6 py-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-brand-accent sm:w-auto sm:px-8">
                  Initiate Link <ExternalLink size={16} />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Container */}
      <div className="container mx-auto max-w-7xl px-4 py-14 sm:py-16 md:px-12 md:py-24">
        
        {/* Quick Stats */}
        <section className="mb-20 md:mb-40">
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
              <motion.div key={i} variants={itemVariants} className="border border-dark-700 p-6 md:p-10 flex flex-col bg-dark-900/40 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-brand-primary/10 group-hover:text-brand-primary/20 transition-colors">
                  {stat.icon}
                </div>
                <div className="text-brand-accent mb-6 md:mb-8">
                  {stat.icon}
                </div>
                <h3 className="text-4xl md:text-5xl font-michroma mb-3 text-white tracking-tighter">{stat.val}</h3>
                <p className="text-gray-500 font-mono uppercase tracking-[0.1em] text-[10px] md:text-xs">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Featured Events */}
        <section className="mb-24 sm:mb-32 md:mb-40">
          <div className="mb-10 flex flex-col items-start gap-4 border-b border-dark-700 pb-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-3xl font-bebas uppercase tracking-widest text-white sm:text-4xl">Featured Events</h2>
            <Link to="/events" className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.1em] text-gray-400 transition-colors hover:text-brand-accent">
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
          <div className="mb-10 flex flex-col items-start gap-4 border-b border-dark-700 pb-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-3xl font-bebas uppercase tracking-widest text-white sm:text-4xl">Top Projects</h2>
            <Link to="/projects" className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.1em] text-gray-400 transition-colors hover:text-brand-accent">
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
                <div className="mt-auto flex flex-col gap-4 border-t border-dark-700 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex -space-x-3">
                    {project.contributors.slice(0,3).map((avatar, i) => (
                      <img key={i} src={avatar} alt="contributor" className="w-10 h-10 border border-dark-700 grayscale opacity-80" />
                    ))}
                  </div>
                  <a href={project.repoUrl} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center justify-center gap-2 border border-brand-primary/30 bg-brand-primary/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.1em] text-brand-accent transition-colors hover:bg-brand-primary hover:text-white sm:justify-start">
                    Repo <ExternalLink size={12} />
                  </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* About & What We Do */}
        <section className="mb-20">
          <div className="mb-10 flex flex-col items-start gap-4 border-b border-dark-700 pb-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-3xl font-bebas uppercase tracking-widest text-white sm:text-4xl">Directive: OSC VIT-AP</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
            <div className="border border-dark-700 p-8 flex flex-col bg-dark-900/40 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 text-brand-primary/10 group-hover:text-brand-primary/20 transition-colors">
                <Target size={80} />
              </div>
              <h3 className="text-2xl font-bebas mb-4 text-white uppercase tracking-wider flex items-center gap-3">
                <Target className="text-brand-accent" size={24} /> Mission Protocol
              </h3>
              <p className="text-gray-500 font-mono text-xs leading-loose relative z-10">
                To cultivate a thriving ecosystem of developers who believe in free, accessible, and collaborative software. We aim to equip students with industry-standard skills by exposing them to version control, software architecture, and collaborative development early in their academic journey.
              </p>
            </div>
            <div className="border border-dark-700 p-8 flex flex-col bg-dark-900/40 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 text-brand-primary/10 group-hover:text-brand-primary/20 transition-colors">
                <Heart size={80} />
              </div>
              <h3 className="text-2xl font-bebas mb-4 text-white uppercase tracking-wider flex items-center gap-3">
                <Heart className="text-brand-accent" size={24} /> Core Culture
              </h3>
              <p className="text-gray-500 font-mono text-xs leading-loose relative z-10">
                We believe in learning in public. We foster an inclusive environment where mistakes are stepping stones, questions are encouraged, and knowledge is freely shared. Whether you're writing your first 'Hello World' or debugging complex architectures, there is a place for you here.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Hackathons", icon: <Zap size={24} />, desc: "Intensive coding sprints building solutions over 24-48 hours." },
              { title: "Open Source", icon: <Terminal size={24} />, desc: "Maintain community projects and help students make first contributions." },
              { title: "Workshops", icon: <Target size={24} />, desc: "Hands-on technical sessions covering Git, cloud, and beyond." },
              { title: "Mentorship", icon: <Heart size={24} />, desc: "Peer-to-peer guidance navigating tech careers and development." }
            ].map((item, i) => (
              <motion.div key={i} variants={itemVariants} className="border border-dark-700 p-6 flex flex-col bg-dark-900/40 group hover:border-brand-primary/50 transition-colors">
                <div className="mb-4 text-brand-accent group-hover:text-brand-primary transition-colors">
                  {item.icon}
                </div>
                <h4 className="text-lg font-bebas text-white uppercase tracking-wider mb-2">{item.title}</h4>
                <p className="text-gray-500 font-mono text-[10px] leading-loose">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default Home;
