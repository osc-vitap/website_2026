import { Github, Instagram, Linkedin, Mail, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { config } from '../data/config';

const Footer = () => {
  return (
    <footer className="border-t border-dark-600/50 bg-dark-900/80 backdrop-blur-md pt-16 pb-8 mt-20 relative z-10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          {/* Brand Col */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 group mb-4">
              <div className="p-2 bg-dark-800 rounded-lg border border-dark-600">
                <Terminal className="text-brand-primary" size={24} />
              </div>
              <span className="font-bold text-xl tracking-tight">OSC<span className="text-brand-primary">VIT-AP</span></span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm mb-6">
              Building a robust open-source culture at VIT-AP. We code, collaborate, and create solutions for the real world.
            </p>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <a href={config.socials.discord} target="_blank" rel="noreferrer" className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold min-h-[44px] py-2 px-4 transition-colors inline-flex items-center gap-2">
                Join Discord
              </a>
              <a href={config.socials.whatsapp} target="_blank" rel="noreferrer" className="bg-[#25D366] hover:bg-[#1DA851] text-white text-sm font-semibold min-h-[44px] py-2 px-4 transition-colors inline-flex items-center gap-2">
                WhatsApp
              </a>
            </div>
          </div>

          {/* Links Col */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-0.5">
              <li><Link to="/about" className="inline-flex items-center min-h-[36px] text-gray-400 hover:text-brand-accent transition-colors text-sm">About Us</Link></li>
              <li><Link to="/events" className="inline-flex items-center min-h-[36px] text-gray-400 hover:text-brand-accent transition-colors text-sm">Events</Link></li>
              <li><Link to="/projects" className="inline-flex items-center min-h-[36px] text-gray-400 hover:text-brand-accent transition-colors text-sm">Projects</Link></li>
              <li><Link to="/team" className="inline-flex items-center min-h-[36px] text-gray-400 hover:text-brand-accent transition-colors text-sm">Our Team</Link></li>
            </ul>
          </div>

          {/* Socials Col */}
          <div>
            <h4 className="text-white font-semibold mb-4">Connect</h4>
            <div className="flex flex-col items-start space-y-1">
              <a href={config.socials.github} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-[36px] gap-3 text-gray-400 hover:text-white transition-colors text-sm">
                <Github size={18} className="shrink-0" /> GitHub
              </a>
              <a href={config.socials.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-[36px] gap-3 text-gray-400 hover:text-[#8ab4e8] transition-colors text-sm">
                <Linkedin size={18} className="shrink-0" /> LinkedIn
              </a>
              <a href={config.socials.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-[36px] gap-3 text-gray-400 hover:text-[#E1306C] transition-colors text-sm">
                <Instagram size={18} className="shrink-0" /> Instagram
              </a>
              <a href={config.socials.email} className="inline-flex items-center min-h-[36px] gap-3 text-gray-400 hover:text-brand-accent transition-colors text-sm">
                <Mail size={18} className="shrink-0" /> Email Us
              </a>
            </div>
          </div>
        </div>

        {/* Partners Placeholder */}
        <div className="border-t border-dark-600/50 pt-8 mb-8">
          <h4 className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">Our Partners &amp; Sponsors</h4>
          <div aria-hidden="true" className="flex flex-wrap justify-center gap-4 sm:gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
            {/* Placeholders for logos */}
            <div className="h-8 w-24 bg-dark-600"></div>
            <div className="h-8 w-32 bg-dark-600"></div>
            <div className="h-8 w-24 bg-dark-600"></div>
            <div className="h-8 w-28 bg-dark-600"></div>
          </div>
        </div>

        <div className="text-center text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} Open Source Community VIT-AP. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
