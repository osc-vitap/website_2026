import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Search } from 'lucide-react';
import SearchModal from './SearchModal';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Gallery', path: '/gallery' },
  { name: 'Team', path: '/team' },
  { name: 'Contributors', path: '/contributors' },
  { name: 'Events', path: '/events' },
  { name: 'Projects', path: '/projects' },
  { name: 'News', path: '/news' },
  { name: 'Contact', path: '/contact' },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcut for search, and Escape to close the mobile menu.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // A link is current on its own page and on anything nested under it, so
  // /events/:slug/register still highlights Events.
  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <>
      <nav className={`sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'glass py-3' : 'bg-transparent py-4 sm:py-5'}`}>
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 md:px-6">
          
          {/* Logo */}
            <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3 select-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent">
              {/* Static Photo Logo */}
              <img
                src="/events/favicon.png"
                alt="OSC Logo"
                width={32}
                height={32}
                className="w-8 h-8 object-contain flex-shrink-0"
              />

              {/* Typography */}
              <span className="truncate font-bebas text-2xl font-bold uppercase tracking-[0.18em] text-white sm:text-3xl sm:tracking-wider">
                OSC<span className="text-[#7c3aed]">VIT-AP</span>
              </span>
            </Link>

          {/* Desktop Nav. Only from lg up: the eight links plus the logo and
              the search button do not fit on a 768px tablet. */}
          <div className="hidden lg:flex items-center gap-8">
            <div className="flex gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={`text-xs font-mono uppercase tracking-widest transition-colors hover:text-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent ${
                    isActive(link.path) ? 'text-brand-accent' : 'text-gray-300'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-dark-900 text-sm text-gray-300 border border-dark-600 hover:text-white hover:border-brand-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <Search size={16} />
              <span className="uppercase tracking-widest text-xs">Search</span>
              <kbd className="hidden xl:inline-block text-xs bg-dark-800 px-2 py-1 ml-2 font-mono">Ctrl+K</kbd>
            </button>
          </div>

          {/* Mobile Toggle */}
          <div className="flex shrink-0 items-center gap-1 lg:hidden">
            <button
              onClick={() => setIsSearchOpen(true)}
              aria-label="Open search"
              className="flex items-center justify-center min-w-[44px] min-h-[44px] text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <Search size={20} />
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              aria-controls="mobile-nav"
              className="flex items-center justify-center min-w-[44px] min-h-[44px] text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav. Capped and scrollable so every link stays reachable
            on short viewports and in landscape. */}
        {isOpen && (
          <div
            id="mobile-nav"
            className="absolute left-0 top-full flex max-h-[calc(100vh-6rem)] w-full flex-col items-start gap-2 overflow-y-auto border-b border-dark-600 bg-dark-900 p-4 shadow-2xl lg:hidden"
          >
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsOpen(false)}
                aria-current={isActive(link.path) ? 'page' : undefined}
                className={`text-xs font-mono uppercase tracking-widest w-full text-left px-4 py-4 border border-dark-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${
                  isActive(link.path) ? 'bg-brand-primary text-white border-brand-primary' : 'bg-dark-800 text-gray-300 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};

export default Navbar;
