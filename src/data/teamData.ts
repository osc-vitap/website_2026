export interface TeamMember {
  id: string;
  name: string;
  role: string;
  tier: "Core Leadership" | "Technical Leads" | "Executive Members";
  bio: string;
  image: string;
  socials: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
}

// STRCIT INSTRUCTION: 2026 Placeholder Data Only
export const teamData: TeamMember[] = [
  // Core Leadership
  {
    id: "core-1",
    name: "Alex Mercer",
    role: "President",
    tier: "Core Leadership",
    bio: "Passionate about building scalable systems and empowering communities.",
    image: "https://i.pravatar.cc/300?u=alex",
    socials: {
      github: "https://github.com",
      linkedin: "https://linkedin.com",
      twitter: "https://twitter.com"
    }
  },
  {
    id: "core-2",
    name: "Sarah Chen",
    role: "Vice President",
    tier: "Core Leadership",
    bio: "Full-stack developer focused on creating intuitive user experiences.",
    image: "https://i.pravatar.cc/300?u=sarah",
    socials: {
      github: "https://github.com",
      linkedin: "https://linkedin.com"
    }
  },
  
  // Technical Leads
  {
    id: "tech-1",
    name: "David Kim",
    role: "Technical Lead",
    tier: "Technical Leads",
    bio: "Cloud architecture enthusiast and Open Source contributor.",
    image: "https://i.pravatar.cc/300?u=david",
    socials: {
      github: "https://github.com",
      website: "https://example.com"
    }
  },
  {
    id: "tech-2",
    name: "Priya Patel",
    role: "Open Source Maintainer",
    tier: "Technical Leads",
    bio: "Rust and WebAssembly advocate. Helping others make their first PR.",
    image: "https://i.pravatar.cc/300?u=priya",
    socials: {
      github: "https://github.com",
      linkedin: "https://linkedin.com",
      twitter: "https://twitter.com"
    }
  },
  {
    id: "tech-3",
    name: "Marcus Johnson",
    role: "Project Manager",
    tier: "Technical Leads",
    bio: "Bridging the gap between design and engineering.",
    image: "https://i.pravatar.cc/300?u=marcus",
    socials: {
      linkedin: "https://linkedin.com"
    }
  },

  // Executive Members
  {
    id: "exec-1",
    name: "Elena Rodriguez",
    role: "Event Coordinator",
    tier: "Executive Members",
    bio: "Organizing hackathons and tech meetups for the community.",
    image: "https://i.pravatar.cc/300?u=elena",
    socials: {
      twitter: "https://twitter.com",
      linkedin: "https://linkedin.com"
    }
  },
  {
    id: "exec-2",
    name: "Tomomi Sato",
    role: "Design Lead",
    tier: "Executive Members",
    bio: "Crafting beautiful interfaces and user journeys.",
    image: "https://i.pravatar.cc/300?u=tomomi",
    socials: {
      website: "https://example.com",
      github: "https://github.com"
    }
  },
  {
    id: "exec-3",
    name: "Jamal Davis",
    role: "Content Strategist",
    tier: "Executive Members",
    bio: "Writing about tech trends and community highlights.",
    image: "https://i.pravatar.cc/300?u=jamal",
    socials: {
      linkedin: "https://linkedin.com",
      twitter: "https://twitter.com"
    }
  }
];
