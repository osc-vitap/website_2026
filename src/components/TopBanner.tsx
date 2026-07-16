import { useState } from 'react';
import { config } from '../data/config';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';

const TopBanner = () => {
  const [isVisible, setIsVisible] = useState(config.topBanner.visible);

  if (!isVisible) return null;

  return (
    <div className="bg-brand-primary/20 border-b border-brand-primary/30 backdrop-blur-sm text-center py-2 px-4 relative z-50">
      <p className="text-sm font-medium text-gray-200 inline-block mr-4">
        {config.topBanner.text}
      </p>
      <Link 
        to={config.topBanner.ctaLink}
        className="inline-block bg-brand-primary hover:bg-brand-primary/80 text-white text-xs px-3 py-1 rounded-full transition-colors font-semibold"
      >
        {config.topBanner.ctaText}
      </Link>
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
        aria-label="Close banner"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default TopBanner;
