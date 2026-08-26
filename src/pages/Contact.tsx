import { useState } from 'react';
import { motion } from 'framer-motion';
import { config } from '../data/config';
import { Mail, MapPin, Send, Instagram, Linkedin, Github } from 'lucide-react';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    // Simulate API call
    setTimeout(() => {
      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setStatus('idle'), 3000);
    }, 1500);
  };

  return (
    <div className="container mx-auto px-4 py-10 sm:py-12 md:px-6">
      
      <div className="mx-auto mb-14 max-w-2xl text-center sm:mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in <span className="text-gradient">Touch</span></h1>
        <p className="text-gray-400">
          Have a question, want to collaborate, or just want to say hi? 
          Drop us a message and we'll get back to you.
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:gap-10 lg:grid-cols-5 lg:gap-12">
        
        {/* Contact Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-6 md:p-8">
            <h3 className="text-xl font-bold mb-6 text-white">Contact Information</h3>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 p-3 bg-dark-700 rounded-lg text-brand-accent">
                  <Mail size={20} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-400 font-medium mb-1">Email Us</p>
                  <a href={config.socials.email} className="inline-flex items-center min-h-[44px] text-gray-200 hover:text-brand-accent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">{config.socials.email.replace('mailto:', '')}</a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="shrink-0 p-3 bg-dark-700 rounded-lg text-brand-accent">
                  <MapPin size={20} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-400 font-medium mb-1">Location</p>
                  <p className="text-gray-200 leading-relaxed">
                    VIT-AP University,<br />
                    Inavolu, Beside AP Secretariat,<br />
                    Amaravati, Andhra Pradesh 522237
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-dark-600 pt-8 sm:mt-10">
              <p className="text-sm text-gray-400 font-medium mb-4">Follow our socials</p>
              <div className="flex flex-wrap gap-4">
                <a href={config.socials.instagram} target="_blank" rel="noreferrer" aria-label="OSC on Instagram" className="inline-flex h-11 w-11 items-center justify-center bg-dark-700 rounded-lg text-gray-400 hover:text-white hover:bg-[#E1306C] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">
                  <Instagram size={20} aria-hidden="true" />
                </a>
                <a href={config.socials.linkedin} target="_blank" rel="noreferrer" aria-label="OSC on LinkedIn" className="inline-flex h-11 w-11 items-center justify-center bg-dark-700 rounded-lg text-gray-400 hover:text-white hover:bg-[#0A66C2] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">
                  <Linkedin size={20} aria-hidden="true" />
                </a>
                <a href={config.socials.github} target="_blank" rel="noreferrer" aria-label="OSC on GitHub" className="inline-flex h-11 w-11 items-center justify-center bg-dark-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">
                  <Github size={20} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-3">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-6 md:p-8 lg:p-10"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2" htmlFor="name">Name</label>
                  <input 
                    type="text" 
                    id="name"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2" htmlFor="email">Email</label>
                  <input 
                    type="email" 
                    id="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent transition-colors"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2" htmlFor="subject">Subject</label>
                <input 
                  type="text" 
                  id="subject"
                  required
                  value={formData.subject}
                  onChange={e => setFormData({...formData, subject: e.target.value})}
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent transition-colors"
                  placeholder="How can we help?"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2" htmlFor="message">Message</label>
                <textarea 
                  id="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent transition-colors resize-none"
                  placeholder="Write your message here..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                aria-live="polite"
                aria-busy={status === 'submitting'}
                className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              >
                {status === 'submitting' ? 'Sending...' : status === 'success' ? 'Message Sent!' : (
                  <>Send Message <Send size={18} aria-hidden="true" /></>
                )}
              </button>
            </form>
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default Contact;
