export interface Project {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  repoUrl: string;
  liveUrl?: string;
  contributors: string[]; // URLs to avatars
}

// Extracted from GitHub org repos
export const projectsData: Project[] = [
  {
    id: "wsoc-website",
    title: "WSoC-Website",
    description: "Official website for Winter of Summer of Code (WSoC). A platform to encourage student participation in open source.",
    techStack: ["JavaScript", "HTML", "CSS"],
    repoUrl: "https://github.com/osc-vitap/WSoC-Website",
    liveUrl: "https://wsoc.oscvitap.org",
    contributors: ["https://i.pravatar.cc/150?u=1", "https://i.pravatar.cc/150?u=2"]
  },
  {
    id: "oschub",
    title: "OSCHub",
    description: "A centralized web application for OSC livestreams, organizing events and content for the community.",
    techStack: ["Django", "Python", "CSS"],
    repoUrl: "https://github.com/osc-vitap/oschub",
    liveUrl: "https://osc-hub.herokuapp.com",
    contributors: ["https://i.pravatar.cc/150?u=3", "https://i.pravatar.cc/150?u=4", "https://i.pravatar.cc/150?u=5"]
  },
  {
    id: "productivity-tracker",
    title: "Productivity-tracker",
    description: "Application to help you stay focused and productive, built as part of OSC's WSoC initiative.",
    techStack: ["Python3"],
    repoUrl: "https://github.com/osc-vitap/Productivity-tracker",
    contributors: ["https://i.pravatar.cc/150?u=6"]
  },
  {
    id: "opensource101",
    title: "OpenSource101",
    description: "A starter repository made specifically to help you get your first pull request and learn the basics of Git and GitHub.",
    techStack: ["Svelte", "JavaScript"],
    repoUrl: "https://github.com/osc-vitap/OpenSource101",
    liveUrl: "https://opensource101.oscvitap.org/",
    contributors: ["https://i.pravatar.cc/150?u=7", "https://i.pravatar.cc/150?u=8"]
  },
  {
    id: "awesome-osc",
    title: "Awesome-OSC",
    description: "A compiled list of resources to help beginners navigate through GitHub and the Open Source world.",
    techStack: ["Markdown"],
    repoUrl: "https://github.com/osc-vitap/Awesome-OSC",
    contributors: ["https://i.pravatar.cc/150?u=9"]
  }
];
