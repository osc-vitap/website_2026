import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Calendar, Search } from 'lucide-react';

const suggestions = [
  {
    to: '/events',
    label: 'Events',
    description: 'Workshops, hackathons and everything coming up.',
    icon: Calendar,
  },
  {
    to: '/projects',
    label: 'Projects',
    description: 'What the community is building right now.',
    icon: Search,
  },
];

const NotFound = () => {
  const { pathname } = useLocation();

  return (
    <div className="container mx-auto px-4 py-16 sm:py-20 md:px-6 md:py-28 font-sans">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-2xl mx-auto text-center"
      >

        <div className="mb-6 text-brand-accent text-xs md:text-sm tracking-[0.3em] uppercase font-bold">
          Error
        </div>

        <h1
          className="glitch-text mb-6 font-bebas text-6xl leading-none tracking-wider text-white sm:text-7xl md:text-9xl"
          data-text="404"
        >
          404
        </h1>

        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          This page doesn't{' '}
          <span className="text-gradient">exist</span>
        </h2>

        <p className="text-gray-400 font-mono text-xs md:text-sm leading-relaxed mb-2">
          Nothing is mapped to this address. It may have been moved, or the
          link that brought you here is out of date.
        </p>

        <p className="text-gray-400 font-mono text-xs mb-10 break-all">
          {pathname}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">

          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-brand-primary text-white font-bold uppercase tracking-[0.1em] text-sm hover:bg-brand-accent hover:text-dark-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>

          <Link
            to="/contact"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 glass border border-dark-600 text-gray-300 font-bold uppercase tracking-[0.1em] text-sm hover:text-white hover:border-gray-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            Report a broken link
          </Link>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">

          {suggestions.map((suggestion) => (
            <Link
              key={suggestion.to}
              to={suggestion.to}
              className="glass-card p-6 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >

              <div className="flex items-center gap-3 mb-2">
                <suggestion.icon
                  size={18}
                  className="text-brand-accent shrink-0"
                />

                <span className="text-white font-bold uppercase tracking-[0.1em] text-sm">
                  {suggestion.label}
                </span>
              </div>

              <p className="text-gray-500 font-mono text-xs leading-relaxed">
                {suggestion.description}
              </p>

            </Link>
          ))}

        </div>

      </motion.div>

    </div>
  );
};

export default NotFound;
