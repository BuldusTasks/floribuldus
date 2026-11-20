import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';

export const SITE_URL = 'https://floribuldus.ro';
export const ARTIST_NAME = 'Flori Bulduș';

/**
 * URL-safe slug for an artwork folder name, e.g. "Esența vieții" -> "esenta-vietii".
 * Keep in sync with slugify() in scripts/generate-seo-pages.mjs.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SeoPage {
  title: string;
  description: string;
  /** Path relative to the site root, e.g. "/artwork/icar/". */
  path: string;
  /** Absolute or site-relative image URL. */
  image?: string;
}

/**
 * Keeps <title>, meta description, canonical and Open Graph tags in sync during
 * client-side navigation. The initial HTML for every page is generated at build
 * time by scripts/generate-seo-pages.mjs, so crawlers that do not run JavaScript
 * get the same values.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(
    private title: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private document: Document
  ) {}

  setPage(page: SeoPage) {
    const url = SITE_URL + page.path;
    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });
    if (page.image) {
      const image = page.image.startsWith('http')
        ? page.image
        : SITE_URL + '/' + encodeURI(page.image.replace(/^\//, ''));
      this.meta.updateTag({ property: 'og:image', content: image });
      this.meta.updateTag({ name: 'twitter:image', content: image });
    }

    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }
}
