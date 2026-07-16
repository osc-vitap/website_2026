import { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projectsData } from '../data/projectsData';
import { eventsData } from '../data/eventsData';
import { teamData } from '../data/teamData';

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

  if (!isOpen) return null;

  const filteredProjects = projectsData.filter(p => p.title.toLowerCase().includes(query.toLowerCase()) || p.description.toLowerCase().includes(query.toLowerCase()));
  const filteredEvents = eventsData.filter(e => e.title.toLowerCase().includes(query.toLowerCase()));
  const filteredTeam = teamData.filter(t => t.name.toLowerCase().includes(query.toLowerCase()) || t.role.toLowerCase().includes(query.toLowerCase()));

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Search Input */}
        <div className="flex items-center px-4 py-4 border-b border-dark-600">
          <Search className="text-gray-400 mr-3" size={20} />
          <input 
            autoFocus
            type="text" 
            placeholder="Search projects, events, members..." 
            className="flex-grow bg-transparent text-white outline-none placeholder-gray-500 text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-dark-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto p-2">
          {query.length > 0 ? (
            <>
              {filteredProjects.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">Projects</h3>
                  {filteredProjects.map(p => (
                    <button key={p.id} onClick={() => handleNavigate('/projects')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-dark-700 transition-colors flex flex-col">
                      <span className="text-gray-200 font-medium">{p.title}</span>
                      <span className="text-xs text-gray-400 truncate">{p.description}</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredEvents.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">Events</h3>
                  {filteredEvents.map(e => (
                    <button key={e.id} onClick={() => handleNavigate('/events')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-dark-700 transition-colors flex justify-between items-center">
                      <span className="text-gray-200 font-medium">{e.title}</span>
                      <span className="text-xs text-brand-accent">{e.date}</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredTeam.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">Team</h3>
                  {filteredTeam.map(t => (
                    <button key={t.id} onClick={() => handleNavigate('/team')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-dark-700 transition-colors flex justify-between items-center">
                      <span className="text-gray-200 font-medium">{t.name}</span>
                      <span className="text-xs text-gray-400">{t.role}</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredProjects.length === 0 && filteredEvents.length === 0 && filteredTeam.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No results found for "{query}"
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              Start typing to search...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-dark-900 border-t border-dark-600 px-4 py-3 flex justify-between items-center text-xs text-gray-500">
          <div className="flex gap-4">
            <span><kbd className="bg-dark-700 px-1.5 py-0.5 rounded text-gray-300 font-mono">↑</kbd> <kbd className="bg-dark-700 px-1.5 py-0.5 rounded text-gray-300 font-mono">↓</kbd> to navigate</span>
            <span><kbd className="bg-dark-700 px-1.5 py-0.5 rounded text-gray-300 font-mono">ESC</kbd> to close</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SearchModal;
