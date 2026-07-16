export interface Event {
  id: string;
  title: string;
  sub_title: string;
  venue: string;
  date: string;
  image: string;
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
    image: "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    url: "#",
    isUpcoming: true,
    description: "Learn the fundamentals of version control, making your first PR, and collaborating on open-source projects."
  },
  
  // Past Events (From JSON)
  {
    id: "past-2023-1",
    title: "Cyber Syndicate",
    sub_title: "Capture The Flag",
    venue: "AB1-G03,04",
    date: "21 Jan 2023",
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
    image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    url: "#",
    isUpcoming: false,
    description: "A beginner-friendly dive into computer networks and internet protocols."
  }
];
