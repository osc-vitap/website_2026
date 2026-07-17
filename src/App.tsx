import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import Team from './pages/Team';
import Events from './pages/Events';
import Projects from './pages/Projects';
import News from './pages/News';
import Contact from './pages/Contact';
import StarBackground from './components/StarBackground';

function App() {
  return (
    <Router>
      <div className="relative min-h-screen flex flex-col">
        <StarBackground />
        
        {/* Foreground Content */}
        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar />
          
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/team" element={<Team />} />
              <Route path="/events" element={<Events />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/news" element={<News />} />
              <Route path="/contact" element={<Contact />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </div>
    </Router>
  );
}

export default App;
