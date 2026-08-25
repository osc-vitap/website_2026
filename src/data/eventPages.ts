import { ComponentType } from 'react';
import GittyUp26 from '../pages/events/GittyUp26';

/*
 * Registry of standalone event pages.
 *
 * Each entry gets a top-level route, so /gittyup26 renders the GittyUp
 * poster page. These render without the site navbar and footer — a
 * poster page owns the whole viewport.
 *
 * Adding an event means adding a component under src/pages/events/ and
 * one entry here. Keep `slug` clear of the site's own routes (/events,
 * /team, /admin, ...) — an event route is matched first and would
 * shadow them. The dev-only check below catches that early.
 */

export interface EventPage {
  /** Path segment: `gittyup26` serves oscvitap.com/gittyup26 */
  slug: string;

  /** Event name, for the registry and any listing UI. */
  name: string;

  /** Slug of the matching event row in D1, used by the register link. */
  registrationSlug: string;

  component: ComponentType;
}

export const eventPages: EventPage[] = [
  {
    slug: 'gittyup26',
    name: 'GITTYUP 26',
    registrationSlug: 'gittyup26',
    component: GittyUp26,
  },
];

/** Route paths owned by the site itself, which an event slug must not shadow. */
export const RESERVED_SLUGS = [
  'admin',
  'contact',
  'contributors',
  'events',
  'gallery',
  'news',
  'projects',
  'team',
];

export const eventPageBySlug = (
  slug: string,
): EventPage | undefined =>
  eventPages.find(
    (page) => page.slug === slug,
  );

/*
 * Finds the poster page for a D1 event, so listings can link to it
 * instead of dropping people straight into the registration form.
 */
export const eventPageForRegistration = (
  registrationSlug: string,
): EventPage | undefined =>
  eventPages.find(
    (page) =>
      page.registrationSlug ===
      registrationSlug,
  );

if (import.meta.env.DEV) {
  for (const page of eventPages) {
    if (RESERVED_SLUGS.includes(page.slug)) {
      console.error(
        `Event page slug "${page.slug}" collides with a site route and would shadow it.`,
      );
    }
  }

  const slugs = eventPages.map(
    (page) => page.slug,
  );

  const duplicates = slugs.filter(
    (slug, index) =>
      slugs.indexOf(slug) !== index,
  );

  if (duplicates.length) {
    console.error(
      `Duplicate event page slugs: ${[...new Set(duplicates)].join(', ')}`,
    );
  }
}
