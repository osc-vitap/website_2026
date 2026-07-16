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
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="w-full font-sans tracking-tight">
      
      {/* 1. Header Slideshow */}
      {slides.length > 0 && (
        <section className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden border-b border-dark-700">
          <AnimatePresence mode='wait'>
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <img 
                src={slides[currentSlide].image} 
                alt={slides[currentSlide].title} 
                className="w-full h-full object-cover grayscale opacity-40"
              />
              <div className="absolute inset-0 bg-dark-900/80"></div>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
                <div className="mb-8 text-brand-accent text-sm tracking-[0.2em] uppercase">
                  [{slides[currentSlide].sub_title}] // {slides[currentSlide].date}
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-10 max-w-4xl text-white uppercase tracking-tighter">
                  {slides[currentSlide].title}
                </h1>
                <p className="text-lg md:text-xl text-gray-400 mb-16 max-w-2xl leading-loose">
                  {slides[currentSlide].description}
                </p>
                <Link to="/events" className="px-10 py-4 border border-dark-600 text-white uppercase tracking-[0.1em] text-sm flex items-center gap-4 bg-dark-900">
                  Explore Events <ArrowRight size={16} />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>

          <button onClick={prevSlide} className="absolute left-8 top-1/2 -translate-y-1/2 p-4 border border-dark-600 text-white bg-dark-900 z-20">
            <ChevronLeft size={24} />
          </button>
          <button onClick={nextSlide} className="absolute right-8 top-1/2 -translate-y-1/2 p-4 border border-dark-600 text-white bg-dark-900 z-20">
            <ChevronRight size={24} />
          </button>
          
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 z-20">
            {slides.map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-1 transition-none ${currentSlide === i ? 'w-16 bg-brand-primary' : 'w-8 bg-dark-600'}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. Upcoming Event Banner */}
      {upcomingEvent && (
        <section className="w-full bg-dark-900 border-b border-dark-700">
          <div className="flex flex-col md:flex-row w-full max-w-7xl mx-auto">
            <div className="md:w-2/5 h-80 relative border-r border-dark-700 hidden md:block p-8">
              <div className="w-full h-full border border-dark-600 overflow-hidden p-2">
                <img src={upcomingEvent.image} alt={upcomingEvent.title} className="w-full h-full object-cover grayscale opacity-50" />
              </div>
            </div>
            <div className="md:w-3/5 p-12 md:p-20 flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-8">
                <span className="text-brand-accent uppercase text-sm tracking-[0.2em] font-bold">
                  [Upcoming]
                </span>
                <span className="text-gray-500 text-sm">{upcomingEvent.date}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 uppercase tracking-tighter">{upcomingEvent.title}</h2>
              <p className="text-gray-400 text-lg mb-12 max-w-2xl leading-loose">{upcomingEvent.description}</p>
              <div>
                <a href={upcomingEvent.url} className="inline-flex items-center gap-3 px-8 py-4 bg-brand-primary text-white font-bold uppercase tracking-[0.1em] text-sm">
                  Register Now <ExternalLink size={16} />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Container */}
      <div className="container mx-auto px-6 md:px-12 py-32 max-w-7xl">
        
        {/* Quick Stats */}
        <section className="mb-48">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="border border-dark-700 p-12 flex flex-col bg-dark-900/50">
              <div className="text-brand-accent mb-10">
                <Code size={32} />
              </div>
              <h3 className="text-5xl font-bold mb-4 text-white">45+</h3>
              <p className="text-gray-500 uppercase tracking-[0.1em] text-sm">Open Source Projects</p>
            </div>
            <div className="border border-dark-700 p-12 flex flex-col bg-dark-900/50">
              <div className="text-brand-accent mb-10">
                <Users size={32} />
              </div>
              <h3 className="text-5xl font-bold mb-4 text-white">350+</h3>
              <p className="text-gray-500 uppercase tracking-[0.1em] text-sm">Active Contributors</p>
            </div>
            <div className="border border-dark-700 p-12 flex flex-col bg-dark-900/50">
              <div className="text-brand-accent mb-10">
                <Calendar size={32} />
              </div>
              <h3 className="text-5xl font-bold mb-4 text-white">120+</h3>
              <p className="text-gray-500 uppercase tracking-[0.1em] text-sm">Events Hosted</p>
            </div>
          </div>
        </section>

        {/* Featured Events */}
        <section className="mb-48">
          <div className="flex justify-between items-end mb-16 border-b border-dark-700 pb-8">
            <h2 className="text-3xl font-bold uppercase tracking-tighter text-white">Featured Events</h2>
            <Link to="/events" className="text-gray-400 flex items-center gap-3 uppercase tracking-[0.1em] text-sm">
              View All <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {featuredEvents.map(event => (
              <div key={event.id} className="border border-dark-700 flex flex-col bg-dark-900/50">
                <div className="h-64 border-b border-dark-700 p-4">
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover grayscale opacity-60" />
                </div>
                <div className="p-10 flex-grow flex flex-col">
                  <div className="text-brand-accent text-sm tracking-[0.1em] uppercase mb-4">{event.date}</div>
                  <h3 className="text-xl font-bold mb-6 text-white uppercase tracking-tight">{event.title}</h3>
                  <p className="text-gray-500 text-sm leading-loose mb-10 flex-grow">{event.description}</p>
                  <Link to="/events" className="inline-block border border-dark-600 text-center py-4 uppercase tracking-[0.1em] text-xs text-gray-300 bg-dark-900">
                    Learn More
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Projects */}
        <section className="mb-20">
          <div className="flex justify-between items-end mb-16 border-b border-dark-700 pb-8">
            <h2 className="text-3xl font-bold uppercase tracking-tighter text-white">Top Projects</h2>
            <Link to="/projects" className="text-gray-400 flex items-center gap-3 uppercase tracking-[0.1em] text-sm">
              View All <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {featuredProjects.map(project => (
              <div key={project.id} className="border border-dark-700 p-10 flex flex-col h-full bg-dark-900/50">
                <h3 className="text-xl font-bold mb-6 text-white uppercase tracking-tight">{project.title}</h3>
                <p className="text-gray-500 text-sm leading-loose mb-10 flex-grow">{project.description}</p>
                <div className="flex flex-wrap gap-3 mb-10">
                  {project.techStack.slice(0,3).map(tech => (
                    <span key={tech} className="px-4 py-2 border border-dark-600 bg-dark-900 text-xs text-gray-400 uppercase tracking-[0.1em]">
                      {tech}
                    </span>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-auto pt-8 border-t border-dark-700">
                  <div className="flex -space-x-4">
                    {project.contributors.slice(0,3).map((avatar, i) => (
                      <img key={i} src={avatar} alt="contributor" className="w-12 h-12 border border-dark-700 grayscale opacity-80" />
                    ))}
                  </div>
                  <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[0.1em] text-brand-accent flex items-center gap-2 bg-brand-primary/10 px-4 py-2 border border-brand-primary/30">
                    Repo <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default Home;
