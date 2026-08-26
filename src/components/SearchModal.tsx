import { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projectsData } from '../data/projectsData';
import { eventsData } from '../data/eventsData';
import { teamData } from '../data/teamData';
import { contributorsData } from '../data/contributorsData';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModal = ({ isOpen, onClose }: SearchModalProps) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Stop the page behind the overlay from scrolling while it is open.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredProjects = projectsData.filter(p => p.title.toLowerCase().includes(query.toLowerCase()) || p.description.toLowerCase().includes(query.toLowerCase()));
  const filteredEvents = eventsData.filter(e => e.title.toLowerCase().includes(query.toLowerCase()));
  const filteredTeam = teamData.filter(t => t.name.toLowerCase().includes(query.toLowerCase()) || t.role.toLowerCase().includes(query.toLowerCase()));
  const filteredContributors = contributorsData.filter(c => c.login.toLowerCase().includes(query.toLowerCase()));

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-14 sm:px-4 sm:pt-20">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div role="dialog" aria-modal="true" aria-label="Search the site" className="relative flex max-h-[calc(100vh-5rem)] w-full max-w-2xl flex-col overflow-hidden border border-dark-600 bg-dark-800 shadow-2xl sm:max-h-[80vh]">

        {/* Search Input */}
        <div className="flex items-center border-b border-dark-600 py-2 pl-3 pr-2 transition-colors focus-within:border-brand-primary sm:pl-4">
          <Search className="text-gray-400 mr-3 shrink-0" size={20} />
          <input
            autoFocus
            type="text"
            aria-label="Search projects, events and members"
            placeholder="Search projects, events, members..."
            className="flex-grow min-w-0 bg-transparent text-white outline-none placeholder-gray-400 text-base sm:text-lg py-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose} aria-label="Close search" className="shrink-0 h-11 w-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-700 focus-visible:bg-dark-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto p-2">
          {query.length > 0 ? (
            <>
              {filteredProjects.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Projects</h3>
                  {filteredProjects.map(p => (
                    <button key={p.id} onClick={() => handleNavigate('/projects')} className="w-full min-h-[44px] text-left px-3 py-2 hover:bg-dark-700 focus-visible:bg-dark-700 transition-colors flex flex-col justify-center">
                      <span className="text-gray-200 font-medium truncate">{p.title}</span>
                      <span className="text-xs text-gray-400 truncate">{p.description}</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredEvents.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Events</h3>
                  {filteredEvents.map(e => (
                    <button key={e.id} onClick={() => handleNavigate('/events')} className="flex min-h-[44px] w-full flex-col items-start gap-1 px-3 py-2 text-left transition-colors hover:bg-dark-700 focus-visible:bg-dark-700 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="min-w-0 truncate text-gray-200 font-medium">{e.title}</span>
                      <span className="text-xs text-brand-accent sm:shrink-0">{e.date}</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredTeam.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Team</h3>
                  {filteredTeam.map(t => (
                    <button key={t.id} onClick={() => handleNavigate('/team')} className="flex min-h-[44px] w-full flex-col items-start gap-1 px-3 py-2 text-left transition-colors hover:bg-dark-700 focus-visible:bg-dark-700 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="min-w-0 truncate text-gray-200 font-medium">{t.name}</span>
                      <span className="max-w-full text-xs text-gray-400 sm:max-w-[45%] sm:truncate sm:shrink-0">{t.role}</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredContributors.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Core Contributors</h3>
                  {filteredContributors.map(c => (
                    <button 
                      key={c.login} 
                      onClick={() => {
                        window.open(c.html_url, '_blank');
                        onClose();
                        setQuery('');
                      }} 
                      className="w-full min-h-[44px] gap-3 text-left px-3 py-2 hover:bg-dark-700 focus-visible:bg-dark-700 transition-colors flex justify-between items-center"
                    >
                      <span className="text-gray-200 font-medium truncate min-w-0">@{c.login}</span>
                      <span className="text-xs text-gray-400 shrink-0">GitHub</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredProjects.length === 0 && filteredEvents.length === 0 && filteredTeam.length === 0 && filteredContributors.length === 0 && (
                <div className="text-center px-4 py-8 text-gray-400 break-words">
                  No results found for "{query}"
                </div>
              )}
            </>
          ) : (
            <div className="text-center px-4 py-8 text-gray-400 text-sm">
              Start typing to search...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-dark-600 bg-dark-900 px-4 py-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span><kbd className="bg-dark-700 px-1.5 py-0.5 text-gray-200 font-mono">TAB</kbd> to move through results</span>
            <span><kbd className="bg-dark-700 px-1.5 py-0.5 text-gray-200 font-mono">ESC</kbd> to close</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SearchModal;
