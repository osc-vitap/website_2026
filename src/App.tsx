import {
  lazy,
  Suspense,
  useEffect,
  useState,
} from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  Navigate,
} from 'react-router-dom';
import { useStandalone } from './data/standalone';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import Team from './pages/Team';
import Contributors from './pages/Contributors';
import Events from './pages/Events';
import Projects from './pages/Projects';
import News from './pages/News';
import GittyUpPostponed from './pages/GittyUpPostponed';
import Contact from './pages/Contact';
import StarBackground from './components/StarBackground';
import EventCountdown from './components/EventCountdown';

import EventRegistration from './pages/EventRegistration';

/*
 * The admin panel is split out of the main bundle.
 *
 * Imported normally it was compiled into the same chunk every visitor
 * downloads, so the panel's field labels, its API paths and the shape of
 * the registration record were all sitting in the JavaScript served to
 * someone reading the events page. Behind lazy() none of that ships
 * until the route is actually visited.
 *
 * The access check is still the Worker's; this only stops the panel
 * being handed out unasked.
 */
const AdminDashboard = lazy(
  () => import('./pages/AdminDashboard'),
);

const AdminRestricted = lazy(
  () => import('./pages/AdminRestricted'),
);

import NotFound from './pages/NotFound';

import { eventPageRoutes } from './data/eventPages';

/*
 * The site shell: starfield, navbar and footer around a page.
 * Event poster pages deliberately render outside this.
 */
const SiteLayout = () => (
  <div className="relative min-h-screen flex flex-col">
    <StarBackground />

    {/* Foreground Content */}
    <div className="relative z-10 flex flex-col min-h-screen">
      <Navbar />

      {/* Sits in the shell so every page carries it, and retires
          itself once there is nothing upcoming to count down to. */}
      <EventCountdown />

      <main className="flex-grow">
        <Outlet />
      </main>

      <Footer />
    </div>
  </div>
);

/*
 * Launching the installed app opens the panel.
 *
 * The manifest's start_url already says /admin, so this only matters
 * when the launch does not go through it: an OS that restored the last
 * URL, a shortcut someone saved by hand, a share target. Landing on the
 * marketing home page from an icon labelled OSC Admin is the wrong
 * answer in all of those.
 *
 * It fires once per app session rather than pinning the route. Inside
 * the app the club site is still reachable — the admin panel links to
 * the event page — and a permanent redirect would make going back to /
 * impossible instead of merely unusual.
 */
let launchHandled = false;

const StandaloneLaunch = () => {
  const standalone = useStandalone();

  /*
   * The decision is taken once per mount and the flag is set from an
   * effect, never during render.
   *
   * Written the obvious way — check the flag, set it, return a redirect
   * — this silently did nothing. StrictMode renders twice in
   * development; the first pass set the flag and returned the redirect,
   * the second saw the flag already set and returned the home page
   * instead, and the second is the one that commits. Reading through a
   * lazy initialiser keeps both passes agreeing, because nothing has
   * moved by the time the second one runs.
   */
  const [redirect] = useState(
    () => standalone && !launchHandled,
  );

  useEffect(() => {
    if (redirect) launchHandled = true;
  }, [redirect]);

  if (!redirect) return <Home />;

  return <Navigate to="/admin" replace />;
};

/* Shown while a split route's chunk is in flight. */
const RouteFallback = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[60vh] items-center justify-center text-sm text-gray-500"
  >
    Loading…
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
      <Routes>

        {/* One top-level route per event page and its aliases, e.g.
            /gittyup26 and /gittyup. Declared before the shell so an
            event path wins over the 404. */}
        {eventPageRoutes().map(
          ({ path, page }) => (
            <Route
              key={path}
              path={`/${path}`}
              element={<page.component />}
            />
          ),
        )}

        <Route element={<SiteLayout />}>

          <Route path="/events/:slug/register" element={<EventRegistration />} />

          <Route path="/admin" element={<AdminDashboard />} />

          {/*
            * Where the Worker sends a browser whose sign-in did not go
            * through. Before this existed, a failed OAuth left the person
            * on a JSON body at events.oscvitap.com with no way back.
            */}
          <Route path="/admin/restricted" element={<AdminRestricted />} />

          <Route path="/" element={<StandaloneLaunch />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/team" element={<Team />} />
          <Route path="/contributors" element={<Contributors />} />
          <Route path="/events" element={<Events />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/gitty-up-postponed" element={<GittyUpPostponed />} />
          <Route path="/contact" element={<Contact />} />

          {/* Vercel rewrites every unknown path to index.html, so the
              404 is rendered here rather than by the host. */}
          <Route path="*" element={<NotFound />} />
        </Route>

      </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
