import { useState } from 'react';
import { config } from '../data/config';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';

const TopBanner = () => {
  const [isVisible, setIsVisible] = useState(config.topBanner.visible);

  if (!isVisible) return null;

  return (
    <div className="bg-brand-primary/20 border-b border-brand-primary/30 backdrop-blur-sm py-2 pl-4 pr-12 sm:px-12 relative z-50">
      {/* Wraps instead of running under the close button on narrow screens. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
        <p className="text-sm font-medium text-gray-200">
          {config.topBanner.text}
        </p>
        <Link
          to={config.topBanner.ctaLink}
          className="inline-flex items-center bg-brand-primary hover:bg-brand-primary/80 text-white text-xs px-4 py-2 rounded-full transition-colors font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
        >
          {config.topBanner.ctaText}
        </Link>
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-gray-300 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
        aria-label="Close banner"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default TopBanner;
