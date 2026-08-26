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
    /*
     * Leave these empty until the real invites exist.
     *
     * They previously held ".../placeholder", and discord.gg/placeholder
     * is a live invite to an unrelated server — the footer was sending
     * the club's own members there. isConfigured() below is what the
     * footer checks, so an unset link renders no button at all.
     */
    discord: "https://discord.gg/6QtYDd6Eh",
    whatsapp: "",
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

/*
 * Whether a social link is real enough to render a button for.
 *
 * Guards against the two ways an unset link used to reach production:
 * an empty string, and a ".../placeholder" URL that happens to resolve
 * to somebody else's server.
 */
export const isConfigured = (link: string | undefined): boolean =>
  typeof link === 'string' &&
  link.trim() !== '' &&
  !/placeholder/i.test(link);
