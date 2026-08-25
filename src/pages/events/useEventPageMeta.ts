import { useEffect } from 'react';

/*
 * Sets the document title and meta description while an event poster
 * page is mounted, and restores them on the way out.
 *
 * Lives apart from eventPageKit.tsx because mixing hook and component
 * exports in one module breaks Fast Refresh.
 */
export const useEventPageMeta = (
  title: string,
  description: string,
) => {
  useEffect(() => {
    const previousTitle = document.title;

    const descriptionTag =
      document.querySelector(
        'meta[name="description"]',
      );

    const previousDescription =
      descriptionTag?.getAttribute('content') ??
      '';

    document.title = title;
    descriptionTag?.setAttribute(
      'content',
      description,
    );

    return () => {
      document.title = previousTitle;
      descriptionTag?.setAttribute(
        'content',
        previousDescription,
      );
    };
  }, [title, description]);
};
