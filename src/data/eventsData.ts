export interface Event {
  id: string;
  title: string;
  sub_title: string;
  venue: string;
  date: string;
  image: string;
  carouselImage: string;
  url: string;
  isUpcoming: boolean;
  description: string;
}

// Extracted from original OSC-Web repository + Added placeholders for 2026
export const eventsData: Event[] = [
  // Upcoming Events (2026 Placeholders)
  {
    id: "upcoming-1",
    title: "OSC Hack 2026",
    sub_title: "Annual Open Source Hackathon",
    venue: "Main Auditorium, VIT-AP",
    date: "15 Oct 2026",
    image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    carouselImage: "",
    url: "#",
    isUpcoming: true,
    description: "Join us for 48 hours of non-stop coding, collaboration, and open-source contributions. Exciting prizes and swags await!"
  },
  {
    id: "upcoming-2",
    title: "Git & GitHub Workshop",
    sub_title: "Version Control Masterclass",
    venue: "AB1-G03",
    date: "28 Aug 2026",
    carouselImage: "",
    image: "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    url: "#",
    isUpcoming: true,
    description: "Learn the fundamentals of version control, making your first PR, and collaborating on open-source projects."
  },
  
  // Past Events (From JSON)
  {
    id: "past-2026-3",
    title: "RECON 2026",
    sub_title: "National Workshop on System Security",
    venue: "Central Block, VIT-AP University",
    date: "19–21 Apr 2026",
    carouselImage: "/events/reconpic.jpeg",
    image: "/events/ReConLOGO_Final.png",
    url: "#",
    isUpcoming: false,
    description: "A three-day cybersecurity experience that blended hands-on workshops, CTFs, expert sessions, and real-world security challenges into an immersive learning journey."
  },
 
  {
    id: "past-2026-1",
    title: "Dumbathon 2.0",
    sub_title: "Apocalypse Protocol",
    venue: "421, AB-1",
    date: "14 Mar 2026",
    carouselImage: "events/dumb.JPG",
    image: "/events/dumbathon.jpg",
    url: "#",
    isUpcoming: false,
    description: "Designed to challenge convention, the hackathon proved that the most remarkable ideas often emerge from the most unexpected beginnings."
  },
  {
    id: "past-2026-2",
    title: "Project ATLAS",
    sub_title: "Orbital Cascade",
    venue: "Newton Hall, AB-1",
    date: "21 Jan 2026",
    carouselImage: "events/oscxseds.JPG",
    image: "/events/atlas.jpg",
    url: "#",
    isUpcoming: false,
    description: "Inspired by the mysteries of space, the experience transformed technical challenges into an unforgettable mission of strategy, precision, and discovery."
  },
  {
    id: "past-2025-1",
    title: "GittyUp",
    sub_title: "Hands-On Introduction to Git & GitHub",
    venue: "Einstein Hall, AB1",
    date: "12 Dec 2025",
    carouselImage: "events/gittypic.JPG",
    image: "/events/25gittyup.jpg",
    url: "#",
    isUpcoming: false,
    description: "A hands-on workshop introducing Git, GitHub, and version control through practical exercises and collaborative workflows."
  },
  {
    id: "past-2025-2",
    title: "AI Bootcamp",
    sub_title: "Agents in Action",
    venue: "Newton Hall, AB-1",
    date: "24 Sep 2025",
    carouselImage: "",
    image: "/events/ai-bootcamp.jpg",
    url: "#",
    isUpcoming: false,
    description: "An immersive exploration into the world of AI agents, where intelligent automation, innovation, and emerging technologies came together in a single experience."
  },
  {
    id: "past-2025-3",
    title: "Hit The Hitler",
    sub_title: "Capture The Flag",
    venue: "Newton Hall, AB-1",
    date: "9 Aug 2025",
    carouselImage: "",
    image: "/events/hitler.jpg",
    url: "#",
    isUpcoming: false,
    description: "A GitHub-themed Capture The Flag challenge that tested participants' OSINT, Git, and problem-solving skills through interactive cybersecurity missions."
  },
  
  
  {
    id: "past-2023-1",
    title: "Cyber Syndicate",
    sub_title: "Capture The Flag",
    venue: "AB1-G03,04",
    date: "21 Jan 2023",
    carouselImage: "",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", // using high quality unsplash fallback
    url: "#",
    isUpcoming: false,
    description: "An intensive CTF challenge designed for cybersecurity enthusiasts."
  },
  {
    id: "past-2022-4",
    title: "GITTY UP: Learn Git & GitHub",
    sub_title: "Workshop",
    venue: "Auditorium",
    date: "27 Sept 2022",
    carouselImage: "",
    image: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    url: "https://opensource101.oscvitap.org/",
    isUpcoming: false,
    description: "A comprehensive workshop covering everything from git init to managing complex merge conflicts."
  },
  {
    id: "past-2022-2",
    title: "Docker Fundamentals",
    sub_title: "Workshop",
    venue: "Online",
    date: "11 June 2022",
    carouselImage: "",
    image: "https://images.unsplash.com/photo-1605745341112-85968b19335b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    url: "#",
    isUpcoming: false,
    description: "Learn how to containerize your applications using Docker and deploy them anywhere."
  },
  {
    id: "past-2022-1",
    title: "Getting Started with Networking",
    sub_title: "Workshop",
    venue: "Online",
    date: "9 June 2022",
    carouselImage: "",
    image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    url: "#",
    isUpcoming: false,
    description: "A beginner-friendly dive into computer networks and internet protocols."
  }
];
