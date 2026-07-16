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
    <div className="container mx-auto px-4 md:px-6 py-12">
      
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in <span className="text-gradient">Touch</span></h1>
        <p className="text-gray-400">
          Have a question, want to collaborate, or just want to say hi? 
          Drop us a message and we'll get back to you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 max-w-6xl mx-auto">
        
        {/* Contact Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-8">
            <h3 className="text-xl font-bold mb-6 text-white">Contact Information</h3>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-dark-700 rounded-lg text-brand-accent">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Email Us</p>
                  <a href={config.socials.email} className="text-gray-200 hover:text-brand-accent transition-colors">osc@vitap.ac.in</a>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-dark-700 rounded-lg text-brand-accent">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Location</p>
                  <p className="text-gray-200 leading-relaxed">
                    VIT-AP University,<br />
                    Inavolu, Beside AP Secretariat,<br />
                    Amaravati, Andhra Pradesh 522237
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-dark-600">
              <p className="text-sm text-gray-500 font-medium mb-4">Follow our socials</p>
              <div className="flex gap-4">
                <a href={config.socials.instagram} target="_blank" rel="noreferrer" className="p-2 bg-dark-700 rounded-lg text-gray-400 hover:text-white hover:bg-[#E1306C] transition-all">
                  <Instagram size={20} />
                </a>
                <a href={config.socials.linkedin} target="_blank" rel="noreferrer" className="p-2 bg-dark-700 rounded-lg text-gray-400 hover:text-white hover:bg-[#0A66C2] transition-all">
                  <Linkedin size={20} />
                </a>
                <a href={config.socials.github} target="_blank" rel="noreferrer" className="p-2 bg-dark-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                  <Github size={20} />
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
            className="glass-card p-8 md:p-10"
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
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary transition-colors"
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
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary transition-colors"
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
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary transition-colors"
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
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-primary transition-colors resize-none"
                  placeholder="Write your message here..."
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={status === 'submitting'}
                className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {status === 'submitting' ? 'Sending...' : status === 'success' ? 'Message Sent!' : (
                  <>Send Message <Send size={18} /></>
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
