import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Search, Terminal } from 'lucide-react';
import SearchModal from './SearchModal';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Team', path: '/team' },
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

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <nav className={`sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'glass py-3' : 'bg-transparent py-5'}`}>
        <div className="container mx-auto px-4 md:px-6 flex justify-between items-center">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="p-2 bg-dark-900 border border-dark-600">
              <Terminal className="text-brand-primary" size={24} />
            </div>
            <span className="font-bebas text-3xl tracking-wider uppercase">OSC<span className="text-brand-primary">VIT-AP</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`text-xs font-mono uppercase tracking-widest transition-colors hover:text-brand-primary ${
                    location.pathname === link.path ? 'text-brand-primary' : 'text-gray-300'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
            
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-dark-900 text-sm text-gray-400 border border-dark-600"
            >
              <Search size={16} />
              <span className="uppercase tracking-widest text-xs">Search</span>
              <kbd className="hidden lg:inline-block text-xs bg-dark-800 px-2 py-1 ml-2 font-mono">Ctrl+K</kbd>
            </button>
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden flex items-center gap-4">
            <button onClick={() => setIsSearchOpen(true)} className="text-gray-300 hover:text-white">
              <Search size={20} />
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-300 hover:text-white">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-dark-900 border-b border-dark-600 flex flex-col items-start p-4 gap-2 shadow-2xl">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={`text-xs font-mono uppercase tracking-widest w-full text-left px-4 py-4 border border-dark-600 ${
                  location.pathname === link.path ? 'bg-brand-primary text-white border-brand-primary' : 'bg-dark-800 text-gray-400 hover:text-white'
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
