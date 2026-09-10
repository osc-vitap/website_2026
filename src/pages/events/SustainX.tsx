import { motion } from 'framer-motion'
import { EventPageFrame } from './eventPageKit'
import { useEventPageMeta } from './useEventPageMeta'
import { usePosterReady } from './gittyup26/usePosterReady'

const SustainX = () => {
  useEventPageMeta(
    'SustainX',
    'A 2 day innovation hackathon focused on solving real world challenges'
  )

  const ready = usePosterReady([])

  const questions = [
    'Address a specific, real sustainability problem?',
    'Have a clearly identified user/community?',
    'Create a meaningful sustainability impact?',
    "Improve something that currently doesn't work well enough?",
    'Have a solution that can be prototyped within 18 hours?',
    'Have a measurable impact metric?',
    'Have a realistic path toward real-world use?',
    'Go beyond simply raising awareness?'
  ]

  return (
    <EventPageFrame className="font-poster bg-[#003399] text-white selection:bg-[#FFCC00] selection:text-[#003399]">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden relative flex flex-col lg:flex-row">
        <div className="flex-1 p-6 md:p-10 lg:p-12 xl:p-16 z-10 flex flex-col justify-start lg:justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-black text-[#FFCC00] mb-2 tracking-tighter uppercase">
              SustainX
            </h1>
            <h2 className="text-xl md:text-3xl font-bold mb-8 text-[#FFF5E1]">
              SDGs to Startups
            </h2>
            <div className="mb-8 bg-white/10 p-6 border-l-4 border-[#FFCC00] backdrop-blur-sm overflow-hidden">
              <h3 className="text-lg md:text-xl font-bold text-[#FFCC00] mb-2 uppercase tracking-wider">
                Challenge
              </h3>
              <p className="text-base md:text-lg text-[#FFF5E1] leading-relaxed mb-4">
                Identify a real world sustainability problem and build a technology driven solution that creates measurable impact
              </p>
              <h3 className="text-lg md:text-xl font-bold text-[#FFCC00] mb-2 uppercase tracking-wider">
                Rules
              </h3>
              <p className="text-base md:text-lg text-[#FFF5E1] leading-relaxed">
                Submit a valid git repository, intialized after the starting time of the event
              </p>
            </div>
          </motion.div>
        </div>
        <div className="flex-1 p-6 md:p-10 lg:p-12 xl:p-16 bg-[#FFF5E1] text-[#003399] z-10 flex flex-col justify-start lg:justify-center">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="text-xl md:text-2xl font-black mb-1 uppercase">
              Questions to work tick out
            </h3>
            <p className="text-base font-bold text-[#003399] opacity-70 mb-4">
              5 are mandatory
            </p>
            <ul className="space-y-2">
              {questions.map((q, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + (i * 0.1) }}
                  className="flex items-start gap-3 text-base md:text-lg font-medium"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#003399] text-[#FFCC00] flex items-center justify-center font-bold mt-1 text-sm">
                    {i + 1}
                  </div>
                  <span>{q}</span>
                </motion.li>
              ))}
            </ul>

            <h3 className="text-xl md:text-2xl font-black mb-4 uppercase mt-8">
              Event Timeline
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#FFCC00] rounded-full inline-block"></span>
                  Day 1
                </h4>
                <ul className="space-y-1 text-base font-medium opacity-80 ml-4">
                  <li>11:30am to 5:30pm (Hackathon)</li>
                  <li>4pm to 5pm (Evaluation Round 1)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#FFCC00] rounded-full inline-block"></span>
                  Day 2
                </h4>
                <ul className="space-y-1 text-base font-medium opacity-80 ml-4">
                  <li>9am (Start)</li>
                  <li>2pm to 3pm (Evaluation Round 2)</li>
                  <li>5:30pm to 6:30pm (Final Judge Panel)</li>
                  <li>7pm (Results)</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
        <div className="absolute top-0 right-0 w-[50vw] h-full min-h-screen bg-[#FFF5E1] -skew-x-12 translate-x-32 origin-bottom hidden lg:block z-0" />
      </div>

      {!ready && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#003399]"
          role="status"
          aria-label="Loading"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-transparent border-t-[#FFCC00] border-r-[#FFCC00]" />
        </div>
      )}
    </EventPageFrame>
  )
}

export default SustainX
