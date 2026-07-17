export interface TeamMember {
  id: string;
  name: string;
  role: string;
  tier: "Admins" | "Technical Leads" | "Executive Members" | "Track Leads";
  bio: string;
  image: string;
  socials: {
    github?: string;
    linkedin?: string;
    instagram?: string;
    website?: string;
  };
}

export const teamData: TeamMember[] = [
  {
    id: "core-1",
    name: "Mohammed Faariz",
    role: "President",
    tier: "Admins",
    bio: "I maybe different but still the same paint over the canvas which was white before",
    image: "/team/faariz.webp",
    socials: {
      linkedin: "https://www.linkedin.com/in/mohammed-faariz-a-3a5600317/",
      instagram: "https://instagram.com/_cottonrust"
    }
  },
  {
    id: "core-2",
    name: "Izhaan Raza",
    role: "Vice President",
    tier: "Admins",
    bio: "Cool VP :) Started as IoT, transitioned to Backend dev, then agentics then system design and now Embedded Systems and low level.",
    image: "/team/izhaan.webp",
    socials: {
      github: "https://github.com/Izhaan-Raza",
      instagram: "https://instagram.com/izhaann7"
    }
  },
  {
    id: "track-1",
    name: "Pradyumna Basa",
    role: "Technical Track Lead",
    tier: "Track Leads",
    bio: "I love to make stuff and break it all apart. (Also don't ask me about PCB designing please).",
    image: "/team/pradyumna.webp",
    socials: {
      github: "https://github.com/pradyumnabasa",
      linkedin: "https://www.linkedin.com/in/pradyumna-basa-a1641b321",
      instagram: "https://instagram.com/pradyumnabasa"
    }
  },
  {
    id: "track-2",
    name: "Ayushi",
    role: "Non-Technical Track Lead",
    tier: "Track Leads",
    bio: "The only acceptable bribe is vanilla latte and dragons ✨",
    image: "/team/ayushi.webp",
    socials: {
      github: "https://github.com/Ayushi-17"
    }
  },
  {
    id: "tech-1",
    name: "Anant Satya Mohit Kavuru",
    role: "Technical Lead",
    tier: "Technical Leads",
    bio: "CS undergrad, Linux enthusiast, building cool stuff.",
    image: "/team/anant.webp",
    socials: {
      github: "https://github.com/Condition00",
      linkedin: "https://www.linkedin.com/in/anantkavuru",
      instagram: "https://instagram.com/anantkavuru"
    }
  },
  {
    id: "tech-2",
    name: "Harshikaa lasya",
    role: "Technical Co-Lead",
    tier: "Technical Leads",
    bio: "Usually building backend stuff, occasionally breaking it, and always learning something new along the way.",
    image: "/team/harshikaa.webp",
    socials: {
      github: "https://github.com/phoenixx-codes",
      linkedin: "https://www.linkedin.com/in/bhanu-harshikaa-lasya/"
    }
  },
  {
    id: "exec-1",
    name: "Ryan Shreyas Medikonda",
    role: "Creative Lead",
    tier: "Executive Members",
    bio: "Hi! I'm Ryan, creative lead for OSC. Mostly swimming through life, making sense of it all. I currently enjoy playing video games and working out.",
    image: "/team/ryan.webp",
    socials: {
      github: "https://github.com/ryan000007",
      linkedin: "https://www.linkedin.com/in/ryan-shreyas-medikonda-191a91313/",
      instagram: "https://instagram.com/ryxn_07"
    }
  },
  {
    id: "exec-2",
    name: "Piyush Prasad Singh",
    role: "Creative Co-Lead",
    tier: "Executive Members",
    bio: "20 year old 2D / 3D Designer.",
    image: "/team/piyush.webp",
    socials: {
      github: "https://github.com/sanctionednewt/",
      linkedin: "https://linkedin.com/in/piyushps107/",
      instagram: "https://instagram.com/h.suyi.p"
    }
  },
  {
    id: "exec-3",
    name: "Sumedh Singh Gautam",
    role: "Events Lead",
    tier: "Executive Members",
    bio: "Player: Sumedh Singh Gautam. Mission: Build crazy softwares, exploit intelligent systems, and level up by every project. Every challenge is another quest, and every line of code adds experience toward becoming a better engineer.",
    image: "/team/sumedh.webp",
    socials: {
      github: "https://github.com/iamsumedhsg",
      linkedin: "https://linkedin.com/in/sumedh-singh-gautam/",
      website: "https://instagram.com/geek_ssg"
    }
  }
];
