import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Github, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  adminAuthCopy,
  parseAdminAuthReason,
} from '../data/adminAuth';

/*
 * Where a failed admin sign-in lands.
 *
 * The Worker used to answer the browser with a raw JSON body on its own
 * domain, so someone who was simply not in the organisation got
 * {"error":"Access denied..."} on events.oscvitap.com with no way back.
 * It now redirects here with a reason code, and this page says what
 * happened and what to do about it.
 *
 * The reason is attacker-controlled — anyone can open this URL with any
 * query string — so it is narrowed to a known code and only ever used
 * to pick pre-written copy. Nothing from the URL is rendered directly.
 */

const AdminRestricted = () => {
  const [params] = useSearchParams();

  const reason = parseAdminAuthReason(params.get('reason'));

  const copy = adminAuthCopy(reason);

  return (
    <div className="container mx-auto px-4 md:px-6 py-20 md:py-28 font-sans">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-2xl mx-auto text-center"
      >

        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 glass border border-dark-600 flex items-center justify-center">
            <ShieldAlert size={26} className="text-brand-accent" />
          </div>
        </div>

        <div className="mb-6 text-brand-accent text-xs md:text-sm tracking-[0.3em] uppercase font-bold">
          {copy.kicker}
        </div>

        <h1 className="text-2xl md:text-4xl font-bold text-white mb-6 leading-tight">
          {copy.heading}
        </h1>

        <p className="text-gray-400 font-mono text-xs md:text-sm leading-relaxed mb-4">
          {copy.detail}
        </p>

        <p className="text-gray-300 font-mono text-xs md:text-sm leading-relaxed mb-10">
          {copy.next}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">

          {copy.retryable && (
            <Link
              to="/admin"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-brand-primary text-white font-bold uppercase tracking-[0.1em] text-sm hover:bg-brand-accent hover:text-dark-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <RefreshCw size={16} />
              Try signing in again
            </Link>
          )}

          <a
            href="https://github.com/osc-vitap"
            target="_blank"
            rel="noreferrer noopener"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 glass border border-dark-600 text-gray-300 font-bold uppercase tracking-[0.1em] text-sm hover:text-white hover:border-gray-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            <Github size={16} />
            Open the organisation
          </a>

        </div>

        <div className="pt-8 border-t border-dark-700 flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-3">

          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-accent font-mono text-xs transition-colors"
          >
            <ArrowLeft size={14} />
            Back to the site
          </Link>

          <Link
            to="/contact"
            className="text-gray-500 hover:text-brand-accent font-mono text-xs underline underline-offset-4 transition-colors"
          >
            Ask the core team for access
          </Link>

        </div>

        {/*
          * The code is shown so someone reporting a problem can quote it
          * rather than describing the screen. It is the narrowed value,
          * never the raw query parameter.
          */}
        <p className="mt-10 text-gray-700 font-mono text-[11px] tracking-wider">
          reason: {reason}
        </p>

      </motion.div>

    </div>
  );
};

export default AdminRestricted;
