export interface SiteConfig {
  topBanner: {
    visible: boolean;
    text: string;
    ctaText: string;
    ctaLink: string;
  };
  socials: {
    discord: string;
    whatsapp: string;
    instagram: string;
    linkedin: string;
    github: string;
    email: string;
  };
  stats: {
    activeMembers: number;
    projectsBuilt: number;
    eventsHosted: number;
  };
}

export const config: SiteConfig = {
  topBanner: {
    visible: false,
    text: "🚀 Upcoming Event: Open Source Hackathon 2026",
    ctaText: "Register Now",
    ctaLink: "/events" // Update this link when there's an actual external registration form
  },
  socials: {
    discord: "https://discord.gg/placeholder",
    whatsapp: "https://chat.whatsapp.com/placeholder",
    instagram: "https://instagram.com/osc_vitap",
    linkedin: "https://linkedin.com/company/osc-vitap",
    github: "https://github.com/osc-vitap",
    email: "mailto:osc@vitap.ac.in"
  },
  stats: {
    activeMembers: 350,
    projectsBuilt: 45,
    eventsHosted: 120
  }
};
