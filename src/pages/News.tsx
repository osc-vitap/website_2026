import { motion } from 'framer-motion';

// Dummy data for news
const newsData = [
  {
    id: 1,
    title: "Core Committee Recruitment 2026",
    category: "[Recruitment]",
    date: "July 15, 2026",
    excerpt: "We are opening applications for the core committee for the academic year 2026-2027. If you are passionate about open source and community building, apply now!"
  },
  {
    id: 2,
    title: "OSC Hack 2026 Winners Announced",
    category: "[General]",
    date: "June 28, 2026",
    excerpt: "Congratulations to team 'Null Pointers' for winning the annual hackathon with their innovative decentralized application for peer-to-peer sharing."
  },
  {
    id: 3,
    title: "New UI Library Released",
    category: "[Release]",
    date: "May 10, 2026",
    excerpt: "Our tech team has officially published 'OSC-UI', a lightweight React component library designed for rapid prototyping during hackathons."
  },
  {
    id: 4,
    title: "Introduction to Rust Workshop",
    category: "[Workshop]",
    date: "April 05, 2026",
    excerpt: "Join us this weekend as we dive into systems programming with Rust. No prior experience required. Limited seats available in AB1."
  }
];

const getCategoryColor = (cat: string) => {
  if (cat.includes('Recruitment')) return 'text-green-400 border-green-400/20 bg-green-400/10';
  if (cat.includes('Release')) return 'text-blue-400 border-blue-400/20 bg-blue-400/10';
  if (cat.includes('Workshop')) return 'text-orange-400 border-orange-400/20 bg-orange-400/10';
  return 'text-brand-accent border-brand-accent/20 bg-brand-accent/10';
};

const News = () => {
  return (
    <div className="container mx-auto px-4 py-10 sm:py-12 md:px-6">
      
      <div className="mx-auto mb-14 max-w-2xl text-center sm:mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">News & <span className="text-gradient">Announcements</span></h1>
        <p className="text-gray-400">
          Stay updated with the latest happenings, recruitment drives, and releases from OSC.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="relative ml-2 border-l border-dark-600 sm:ml-4 md:ml-0">
          {newsData.map((news, i) => (
            <motion.div 
              key={news.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative ml-6 mb-10 last:mb-0 sm:ml-8 md:ml-12 md:mb-12"
            >
              {/* Timeline dot */}
              <div className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-4 border-dark-900 bg-brand-primary shadow-[0_0_10px_rgba(109,40,217,0.8)] sm:-left-[41px] md:-left-[57px]"></div>
              
              <div className="glass-card p-5 transition-transform hover:-translate-y-1 sm:p-6">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded border ${getCategoryColor(news.category)}`}>
                    {news.category}
                  </span>
                  <span className="text-sm text-gray-400 font-mono">{news.date}</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">{news.title}</h2>
                <p className="text-gray-400 leading-relaxed">
                  {news.excerpt}
                </p>
                {/*
                  * No "Read more" here. There was a button, but each
                  * item is only a title and an excerpt — there is no
                  * article behind it and the button had no handler, so
                  * it did nothing when pressed. Give it somewhere to go
                  * before bringing it back.
                  */}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default News;
