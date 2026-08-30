import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://events.oscvitap.com';

interface NewsItem {
  id: number;
  title: string;
  category: string;
  date: string;
  excerpt: string;
  link: string | null;
}

const getCategoryColor = (cat: string) => {
  if (cat.includes('Recruitment')) return 'text-green-400 border-green-400/20 bg-green-400/10';
  if (cat.includes('Release')) return 'text-blue-400 border-blue-400/20 bg-blue-400/10';
  if (cat.includes('Workshop')) return 'text-orange-400 border-orange-400/20 bg-orange-400/10';
  return 'text-brand-accent border-brand-accent/20 bg-brand-accent/10';
};

const News = () => {
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/news`);
        const data = await res.json();
        if (data.news) {
          setNewsData(data.news);
        }
      } catch (err) {
        console.error('Failed to fetch news', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  return (
    <div className="container mx-auto px-4 py-10 sm:py-12 md:px-6">
      
      <div className="mx-auto mb-14 max-w-2xl text-center sm:mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">News & <span className="text-gradient">Announcements</span></h1>
        <p className="text-gray-400">
          Stay updated with the latest happenings, recruitment drives, and releases from OSC.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="text-center text-gray-500 py-10">Loading...</div>
        ) : newsData.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No news or announcements available.</div>
        ) : (
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
                  <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">
                    {news.excerpt}
                  </p>
                  {news.link && (
                    <Link 
                      to={news.link}
                      className="inline-block mt-5 px-4 py-2 bg-brand-primary/20 border border-brand-primary/50 rounded-md text-brand-primary hover:bg-brand-primary/40 hover:text-white transition-all text-sm font-semibold"
                    >
                      Read the full news post
                    </Link>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default News;
