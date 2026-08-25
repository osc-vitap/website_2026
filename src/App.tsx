import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import Team from './pages/Team';
import Contributors from './pages/Contributors';
import Events from './pages/Events';
import Projects from './pages/Projects';
import News from './pages/News';
import Contact from './pages/Contact';
import StarBackground from './components/StarBackground';

import EventRegistration from './pages/EventRegistration';

import AdminDashboard from './pages/AdminDashboard';

import NotFound from './pages/NotFound';

import { eventPages } from './data/eventPages';

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

      <main className="flex-grow">
        <Outlet />
      </main>

      <Footer />
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>

        {/* One top-level route per event, e.g. /gittyup26. Declared
            before the shell so an event slug wins over the 404. */}
        {eventPages.map((event) => (
          <Route
            key={event.slug}
            path={`/${event.slug}`}
            element={<event.component />}
          />
        ))}

        <Route element={<SiteLayout />}>

          <Route path="/events/:slug/register" element={<EventRegistration />} />

          <Route path="/admin" element={<AdminDashboard />} />

          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/team" element={<Team />} />
          <Route path="/contributors" element={<Contributors />} />
          <Route path="/events" element={<Events />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/news" element={<News />} />
          <Route path="/contact" element={<Contact />} />

          {/* Vercel rewrites every unknown path to index.html, so the
              404 is rendered here rather than by the host. */}
          <Route path="*" element={<NotFound />} />
        </Route>

      </Routes>
    </Router>
  );
}

export default App;
