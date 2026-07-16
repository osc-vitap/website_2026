import { motion } from 'framer-motion';
import { Target, Zap, Heart, Terminal } from 'lucide-react';

const About = () => {
  return (
    <div className="container mx-auto px-4 md:px-6 py-12">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-20">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold mb-6"
        >
          About <span className="text-gradient">OSC VIT-AP</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-gray-400 leading-relaxed"
        >
          We are a student-run technical community at VIT-AP University dedicated to promoting the open-source philosophy. 
          Our mission is to help students navigate the world of tech, collaborate on real-world projects, and build 
          solutions that impact the community.
        </motion.p>
      </div>

      {/* Mission & Vision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
        <div className="glass p-10 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Target size={120} className="text-brand-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <Target className="text-brand-accent" /> Our Mission
          </h2>
          <p className="text-gray-400 leading-relaxed relative z-10">
            To cultivate a thriving ecosystem of developers who believe in free, accessible, and collaborative software. 
            We aim to equip students with industry-standard skills by exposing them to version control, software architecture, 
            and collaborative development early in their academic journey.
          </p>
        </div>
        <div className="glass p-10 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Heart size={120} className="text-brand-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <Heart className="text-brand-accent" /> Our Culture
          </h2>
          <p className="text-gray-400 leading-relaxed relative z-10">
            We believe in learning in public. We foster an inclusive environment where mistakes are stepping stones, 
            questions are encouraged, and knowledge is freely shared. Whether you're a first-year student writing your 
            first 'Hello World' or a senior debugging complex architectures, there is a place for you here.
          </p>
        </div>
      </div>

      {/* What We Do */}
      <div className="mb-20">
        <h2 className="text-3xl font-bold text-center mb-12">What We Do</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Hackathons",
              icon: <Zap size={24} />,
              desc: "Intensive coding sprints where teams build innovative solutions to real-world problems over 24-48 hours."
            },
            {
              title: "Open Source",
              icon: <Terminal size={24} />,
              desc: "We maintain community projects and help students make their first contributions to major open-source repositories."
            },
            {
              title: "Workshops",
              icon: <Target size={24} />,
              desc: "Hands-on technical sessions covering everything from Git fundamentals to advanced cloud deployment."
            },
            {
              title: "Mentorship",
              icon: <Heart size={24} />,
              desc: "Peer-to-peer guidance helping newcomers navigate their tech careers and project developments."
            }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6"
            >
              <div className="p-3 bg-brand-primary/10 w-fit rounded-lg text-brand-accent mb-4">
                {item.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default About;
