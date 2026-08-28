import { motion } from 'framer-motion';

const GittyUpPostponed = () => {
  return (
    <>
      <div className="fixed inset-0 bg-[#0b0b0d] -z-10"></div>
      <div className="container mx-auto px-4 py-10 sm:py-12 md:px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ fontFamily: "'Objectivity', 'SF Pro Display', -apple-system, sans-serif" }}
      >
        <div className="mb-10 border-b border-[#1c1c1e] pb-10">
          <p className="uppercase text-[#86868b] text-[12px] leading-[16px] tracking-[2.6px] font-mono mb-4">
            [Update] August 28, 2026
          </p>
          <h1 className="text-[40px] md:text-[52px] leading-[48px] md:leading-[56px] font-bold text-white tracking-[-1.5px] mb-4">
            Event Postponed: gitty up is moving to September 1
          </h1>
          <p className="text-[20px] md:text-[22px] leading-[30px] font-light text-[#d6d6db] tracking-[-0.4px]">
            We're rescheduling gitty up. The event, originally planned for Saturday, August 29, will now take place on Tuesday, September 1.
          </p>
        </div>

        <div className="space-y-8 text-[#d6d6db] text-[17px] leading-[26px]">
          <section>
            <h2 className="text-[26px] font-bold text-white mb-4 tracking-[-0.7px]">Why we're moving the date</h2>
            <p className="mb-4">
              The Hon'ble Chief Justice of India is visiting campus on August 29. The auditorium, which serves as our venue, will be reserved for the visit from 10 AM to 12 PM. With setup and wrap-up on either side, that leaves the event with a window of roughly three hours, from 2 PM to 5 PM.
            </p>
            <p className="mb-4">
              gitty up was built as a full-day program. It's meant to give attendees a proper, unhurried introduction to one of the most important technologies in software: version control, and Git in particular. The session walks through the problems developers faced before Git existed, why Git ultimately won out over the systems that came before it, and finishes with a hands-on look at self-hosting your own Git server, why you'd want to, and why even large companies choose to do it.
            </p>
            <p>
              None of that fits into three hours without cutting corners. And gitty up isn't an event we want to compress.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-white mb-4 tracking-[-0.7px]">What we decided</h2>
            <p>
              Rather than shorten the program or rush attendees through it, we're moving gitty up to September 1. On that date, the auditorium is ours for the full day, with no scheduling conflicts. That means the event can run exactly as designed, with enough time and space for every part of the program to land the way it's meant to.
            </p>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-white mb-4 tracking-[-0.7px]">Updated schedule</h2>
            <p className="mb-6">
              gitty up will now take place on September 1, from 10 AM to 5 PM, at the AB-2 Auditorium. The venue and timing remain unchanged; only the date has moved.
            </p>
            <div className="bg-[#0b0b0e] border border-[#2e2e33] rounded-[14px] p-6 max-w-sm">
              <div className="text-[24px] leading-[30px] font-bold text-white tracking-[-0.8px]">
                1 September 2026
              </div>
              <div className="mt-2 text-[#d6d6db]">
                10am to 5pm<br />AB-2 Auditorium, VIT-AP
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[26px] font-bold text-white mb-4 tracking-[-0.7px]">Thank you for your patience</h2>
            <p className="mb-8">
              We appreciate your understanding as we've worked through this change, and we're looking forward to delivering gitty up exactly as it was meant to be.
            </p>
            <p className="italic text-[#86868b]">
              Open Source Community, VIT-AP
            </p>
          </section>
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default GittyUpPostponed;
