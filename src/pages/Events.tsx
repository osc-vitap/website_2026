import { useState } from 'react';
import { motion } from 'framer-motion';
import { eventsData } from '../data/eventsData';
import { MapPin, Calendar, ExternalLink } from 'lucide-react';

const Events = () => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const upcomingEvents = eventsData.filter(e => e.isUpcoming);
  const pastEvents = eventsData.filter(e => !e.isUpcoming);

  const displayedEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

  return (
    <div className="container mx-auto px-4 md:px-6 py-12">
      
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Events & <span className="text-gradient">Workshops</span></h1>
        <p className="text-gray-400">
          From hands-on technical workshops to 48-hour hackathons, discover what we've been up to and what's coming next.
        </p>
      </div>

      <div className="flex justify-center mb-12">
        <div className="glass p-1 rounded-lg inline-flex">
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
              activeTab === 'upcoming' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            Upcoming Events
          </button>
          <button 
            onClick={() => setActiveTab('past')}
            className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
              activeTab === 'past' ? 'bg-dark-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            Past Events
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {displayedEvents.map((event, i) => (
          <motion.div 
            key={event.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card flex flex-col md:flex-row overflow-hidden group"
          >
            <div className="md:w-2/5 h-48 md:h-auto relative overflow-hidden">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-brand-primary/20 mix-blend-overlay"></div>
            </div>
            
            <div className="p-6 md:w-3/5 flex flex-col">
              <div className="text-brand-accent text-xs font-bold uppercase tracking-widest mb-1">{event.sub_title}</div>
              <h3 className="text-2xl font-bold text-white mb-2">{event.title}</h3>
              <p className="text-gray-400 text-sm mb-6 flex-grow">{event.description}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center text-sm text-gray-300 gap-2">
                  <Calendar size={16} className="text-gray-500" /> {event.date}
                </div>
                <div className="flex items-center text-sm text-gray-300 gap-2">
                  <MapPin size={16} className="text-gray-500" /> {event.venue}
                </div>
              </div>
              
              <a 
                href={event.url} 
                className={`mt-auto w-full py-2.5 rounded-lg font-semibold text-center transition-all flex items-center justify-center gap-2 ${
                  event.isUpcoming 
                    ? 'bg-brand-primary hover:bg-brand-primary/90 text-white' 
                    : 'glass border border-dark-600 hover:border-gray-500 text-gray-300'
                }`}
              >
                {event.isUpcoming ? 'Register Now' : 'View Details'}
                {!event.isUpcoming && <ExternalLink size={16} />}
              </a>
            </div>
          </motion.div>
        ))}

        {displayedEvents.length === 0 && (
          <div className="col-span-1 md:col-span-2 py-20 text-center text-gray-500">
            No {activeTab} events found at the moment. Stay tuned!
          </div>
        )}
      </div>

    </div>
  );
};

export default Events;
