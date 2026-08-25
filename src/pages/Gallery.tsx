import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { galleryData } from '../data/galleryData';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

const Gallery = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // While the lightbox is open, Escape should close it and the page behind it
  // should not scroll out from under the overlay.
  useEffect(() => {
    if (!selectedImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImage]);

  return (
    <div className="container mx-auto px-4 md:px-12 py-16 md:py-24 max-w-7xl pt-32">
      
      <div className="text-center max-w-3xl mx-auto mb-20">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-bebas uppercase tracking-widest text-white mb-6"
        >
          Visual Intel
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 font-mono text-sm leading-loose uppercase tracking-[0.1em]"
        >
          Accessing encrypted visual archives from past operations, hackathons, and community deployments.
        </motion.p>
      </div>

      {galleryData.map((section, idx) => (
        <section key={idx} className="mb-24">
          <div className="flex flex-wrap justify-between items-end gap-x-6 gap-y-2 mb-12 border-b border-dark-700 pb-6">
            <h2 className="text-4xl font-bebas uppercase tracking-widest text-white">{section.category}</h2>
            <span className="text-gray-400 font-mono text-xs uppercase tracking-[0.1em]">{section.images.length} files found</span>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {section.images.map((id, i) => (
              <motion.button
                key={i}
                type="button"
                variants={itemVariants}
                onClick={() => setSelectedImage(id)}
                aria-label={`Open ${section.category} image ${i+1} full size`}
                className="w-full border border-dark-700 bg-dark-900/40 relative overflow-hidden group aspect-video cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              >
                <div className="absolute inset-0 bg-brand-primary/10 mix-blend-overlay z-10 group-hover:opacity-0 transition-opacity duration-500 pointer-events-none"></div>

                {/* Render directly from GDrive with lazy loading and optimized thumbnail sizing.
                    A Drive file that has lost public access renders as a broken-image glyph,
                    so onError hides it and the tile stays a clean dark placeholder. */}
                <img
                  src={`https://drive.google.com/thumbnail?id=${id}&sz=w800`}
                  alt={`${section.category} image ${i+1}`}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 transform group-hover:scale-105"
                />

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-dark-900 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                  <span className="text-[10px] font-mono text-brand-accent uppercase tracking-[0.2em]">{id.slice(0,8)}...</span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </section>
      ))}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Expanded gallery image"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 pt-20 md:p-12 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <button
              type="button"
              aria-label="Close expanded image"
              autoFocus
              className="absolute top-4 right-4 md:top-6 md:right-6 text-gray-300 hover:text-white bg-dark-900/80 p-3 rounded-full hover:bg-brand-primary/20 transition-colors z-[60] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
            >
              <X size={28} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={`https://drive.google.com/thumbnail?id=${selectedImage}&sz=w1920`} 
              alt="Expanded view"
              className="max-w-full max-h-full object-contain border border-dark-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Gallery;
