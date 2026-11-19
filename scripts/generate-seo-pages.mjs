#!/usr/bin/env node
/**
 * Generates search-engine / AI-crawler friendly HTML after `ng build`.
 *
 * Usage:  node scripts/generate-seo-pages.mjs dist/browser
 *
 * For every page (home, each artwork, each exhibition) it writes an index.html
 * with its own <title>, description, canonical URL, Open Graph tags, JSON-LD
 * structured data and a plain-HTML copy of the content (for bots that don't run
 * JavaScript). It also writes 404.html, sitemap.xml and llms.txt.
 *
 * Artist facts used for Google's Knowledge Graph live in ARTIST below.
 */
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Artist facts – keep these consistent with every other profile on the web.
// ---------------------------------------------------------------------------
const SITE = 'https://floribuldus.ro';
const ARTIST = {
  name: 'Flori Bulduș',
  alternateNames: ['Flori Buldus'],
  birthYear: '1956',
  birthPlace: 'Mociu, Cluj County, Romania',
  city: 'Cluj-Napoca',
  email: 'floribuldus@gmail.com',
  phone: '+40741753679',
  phoneDisplay: '+40 741 753 679',
  // Official photo of the artist (helps the Google knowledge panel). Put the file
  // in public/ and set e.g. 'assets/flori-buldus.jpg'. Leave null if none.
  photo: null,
  // Every official profile of the artist: Facebook, Instagram, YouTube channel,
  // Wikidata, Wikipedia, artist union / gallery pages, Artmajeur, Saatchi ...
  // These "sameAs" links are the most important signal for a knowledge panel.
  sameAs: [
    'https://www.facebook.com/flori.buldus/',
  ],
  studio: {
    name: 'Atelier de pictură - Flori Buldus',
    street: 'Strada Brassai Samuel 11',
    city: 'Cluj-Napoca',
    region: 'Cluj',
    country: 'RO',
    lat: 46.7726721,
    lng: 23.5914234,
    googleMaps: 'https://www.google.com/maps?cid=13591492513286647065',
  },
  descriptionEn:
    'Flori Bulduș (b. 1956, Mociu, Cluj County) is a Romanian visual artist based in Cluj-Napoca. ' +
    'A graduate (BA and MA, painting) of the University of Art and Design of Cluj-Napoca, she creates abstract and mixed-media ' +
    'paintings built on mythological and scientific symbols: the Spiral, the Circle, Fire, Water, the Pearl and the Nude.',
  descriptionRo:
    'Flori Bulduș (n. 1956, Mociu, județul Cluj) este o artistă plastică din Cluj-Napoca, absolventă (licență și master, secția pictură) ' +
    'a Universității de Artă și Design din Cluj-Napoca. Pictura sa abstractă și în tehnică mixtă explorează simboluri mitologice și ' +
    'științifice: Spirala, Cercul, Focul, Apa, Perla și Nudul.',
};

const HOME = {
  title: 'Flori Bulduș – Romanian Abstract Painter, Cluj-Napoca | Official Website',
  description:
    'Flori Bulduș (b. 1956) is a Romanian visual artist from Cluj-Napoca. Abstract and mixed-media paintings exploring symbols – ' +
    'the Spiral, the Circle, Fire, Water, the Pearl. Gallery, exhibitions and contact.',
};

const CONCEPT = [
  'In her paintings, Flori Bulduș emphasizes the essential aspects of life and experiments with mixed media techniques, being in a constant search for the essence of things, beyond their ordinary appearance.',
  'Her sources of inspiration stem from life itself, which she observes with an ever-open artistic eye, always ready to capture the artistic dimension of every event or everyday occurrence.',
  'At the same time, the artist is passionate about philosophical themes such as space and time—subjects often explored by painters, poets, and philosophers alike.',
  'She brings her own original contribution to these realms of interpretation, incorporating in her works symbols of mythological or scientific nature.',
  'Some of the recurring symbols in Flori Bulduș’s abstract painting include the Spiral, the Circle, Fire, Water, the Pearl, and the Nude—all reimagined in an innovative manner, evoking with renewed power the feelings and emotions of those who view her art.',
];

// ---------------------------------------------------------------------------

const outDir = path.resolve(process.argv[2] || 'dist/browser');
const templatePath = path.join(outDir, 'index.html');
if (!fs.existsSync(templatePath)) {
  console.error(`No index.html in ${outDir}. Run "ng build" first.`);
  process.exit(1);
}
const template = fs.readFileSync(templatePath, 'utf8');
if (!template.includes('<!--seo-head-->') || !template.includes('<!--seo-body-->')) {
  console.error('index.html is missing the <!--seo-head--> / <!--seo-body--> markers.');
  process.exit(1);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const artworks = readJson(path.join(outDir, 'assets/data.json'));
const exhibitionsIndex = readJson(path.join(outDir, 'assets/exhibitions/index.json'));
const exhibitions = exhibitionsIndex.map((ex) => ({
  ...ex,
  ...readJson(path.join(outDir, 'assets/exhibitions', ex.id, 'exhibition.json')),
}));

// Keep in sync with slugify() in src/app/seo/seo.service.ts
function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const abs = (p) => SITE + '/' + encodeURI(p.replace(/^\//, ''));
const paragraphs = (text) =>
  String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
const truncate = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

// --- Artwork view model ----------------------------------------------------
const works = artworks.map((a) => {
  const en = a.info?.title;
  const name = en && en !== a.title ? `${a.title} (${en})` : a.title;
  const extra = a.info?.additional_info ?? {};
  const slug = slugify(a.folder);
  return {
    slug,
    title: a.title,
    enTitle: en && en !== a.title ? en : null,
    name,
    path: `/artwork/${slug}/`,
    images: a.images.map((img) => `assets/paintings/${a.folder}/${img}`),
    technique: extra.technique,
    dimensions: extra.dimensions,
    description: a.info?.description ?? '',
  };
});

// --- Structured data (JSON-LD) ---------------------------------------------
const ARTIST_ID = `${SITE}/#artist`;
const WEBSITE_ID = `${SITE}/#website`;
const STUDIO_ID = `${SITE}/#studio`;

const personNode = {
  '@type': 'Person',
  '@id': ARTIST_ID,
  name: ARTIST.name,
  alternateName: ARTIST.alternateNames,
  url: `${SITE}/`,
  ...(ARTIST.photo ? { image: abs(ARTIST.photo) } : {}),
  description: ARTIST.descriptionEn,
  jobTitle: 'Visual artist',
  hasOccupation: { '@type': 'Occupation', name: 'Painter' },
  gender: 'https://schema.org/Female',
  birthDate: ARTIST.birthYear,
  birthPlace: {
    '@type': 'Place',
    name: ARTIST.birthPlace,
    address: { '@type': 'PostalAddress', addressLocality: 'Mociu', addressRegion: 'Cluj', addressCountry: 'RO' },
  },
  nationality: { '@type': 'Country', name: 'Romania' },
  homeLocation: { '@type': 'Place', name: `${ARTIST.city}, Romania` },
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'University of Art and Design of Cluj-Napoca',
    alternateName: 'Universitatea de Artă și Design din Cluj-Napoca',
    sameAs: 'https://en.wikipedia.org/wiki/University_of_Art_and_Design_of_Cluj-Napoca',
  },
  knowsAbout: ['Abstract painting', 'Mixed media', 'Oil painting', 'Acrylic painting', 'Symbolism in art'],
  email: `mailto:${ARTIST.email}`,
  telephone: ARTIST.phone,
  workLocation: { '@id': STUDIO_ID },
  mainEntityOfPage: `${SITE}/`,
  sameAs: ARTIST.sameAs,
};

const studioNode = {
  '@type': 'LocalBusiness',
  '@id': STUDIO_ID,
  name: ARTIST.studio.name,
  description: `Painting studio of the Romanian artist ${ARTIST.name} in ${ARTIST.city}.`,
  url: `${SITE}/`,
  image: abs('FBArt.png'),
  telephone: ARTIST.phone,
  email: ARTIST.email,
  founder: { '@id': ARTIST_ID },
  address: {
    '@type': 'PostalAddress',
    streetAddress: ARTIST.studio.street,
    addressLocality: ARTIST.studio.city,
    addressRegion: ARTIST.studio.region,
    addressCountry: ARTIST.studio.country,
  },
  geo: { '@type': 'GeoCoordinates', latitude: ARTIST.studio.lat, longitude: ARTIST.studio.lng },
  hasMap: ARTIST.studio.googleMaps,
};

const websiteNode = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: `${SITE}/`,
  name: ARTIST.name,
  alternateName: ['Flori Buldus', 'Flori Bulduș Art'],
  inLanguage: ['en', 'ro'],
  about: { '@id': ARTIST_ID },
  publisher: { '@id': ARTIST_ID },
};

const breadcrumb = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
});

const jsonLd = (nodes) =>
  `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c')}</script>`;

// --- HTML fragments --------------------------------------------------------
function head({ title, description, path: p, image, ogType = 'website', graph }) {
  const url = SITE + p;
  const img = image ? abs(image) : abs('FBArt.png');
  return `
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${esc(ARTIST.name)}">
  <meta property="og:locale" content="en_US">
  <meta property="og:locale:alternate" content="ro_RO">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${img}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${img}">
  ${jsonLd(graph)}
  `;
}

const nav = `
      <nav><a href="/">${esc(ARTIST.name)}</a> · <a href="/?scrollTo=gallery">Gallery</a> · ${exhibitions
        .map((ex) => `<a href="/exhibitions/${esc(ex.id)}/">${esc(ex.title)}</a>`)
        .join(' · ')}</nav>`;

const worksList = (exclude) => `
      <ul>
${works
  .filter((w) => w.slug !== exclude)
  .map(
    (w) =>
      `        <li><a href="${w.path}">${esc(w.name)}</a>${[w.technique, w.dimensions].filter(Boolean).length ? ' – ' + esc([w.technique, w.dimensions].filter(Boolean).join(', ')) : ''}</li>`
  )
  .join('\n')}
      </ul>`;

const contact = `
      <h2>Contact</h2>
      <address>
        ${esc(ARTIST.studio.name)}, ${esc(ARTIST.studio.street)}, ${esc(ARTIST.studio.city)}, Romania<br>
        Phone / WhatsApp: <a href="tel:${ARTIST.phone}">${esc(ARTIST.phoneDisplay)}</a><br>
        Email: <a href="mailto:${esc(ARTIST.email)}">${esc(ARTIST.email)}</a><br>
        ${ARTIST.sameAs.map((u) => `<a href="${esc(u)}" rel="me">${esc(u)}</a>`).join('<br>\n        ')}
      </address>`;

function body(inner) {
  return `
    <div class="seo-static">${nav}
      <main>${inner}
      </main>
    </div>
    `;
}

function render({ headHtml, bodyHtml }) {
  return template
    .replace(/<!--seo-head-->[\s\S]*?<!--\/seo-head-->/, `<!--seo-head-->${headHtml}<!--/seo-head-->`)
    .replace(/<!--seo-body-->[\s\S]*?<!--\/seo-body-->/, `<!--seo-body-->${bodyHtml}<!--/seo-body-->`);
}

function write(relPath, html) {
  const file = path.join(outDir, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// --- Home ------------------------------------------------------------------
const homeHtml = render({
  headHtml: head({
    title: HOME.title,
    description: HOME.description,
    path: '/',
    ogType: 'profile',
    image: works[0]?.images[0],
    graph: [
      personNode,
      studioNode,
      websiteNode,
      {
        '@type': 'ProfilePage',
        '@id': `${SITE}/#webpage`,
        url: `${SITE}/`,
        name: HOME.title,
        description: HOME.description,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': ARTIST_ID },
        about: { '@id': ARTIST_ID },
        inLanguage: 'en',
      },
      {
        '@type': 'ItemList',
        name: `Paintings by ${ARTIST.name}`,
        itemListElement: works.map((w, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + w.path, name: w.name })),
      },
    ],
  }),
  bodyHtml: body(`
        <h1>${esc(ARTIST.name)} – visual artist, Cluj-Napoca</h1>
        <p><strong>The World of Symbols.</strong> A visual artist who explores the essence of the world through abstract painting.</p>
        <h2>About the artist</h2>
        <p>${esc(ARTIST.descriptionEn)}</p>
        <p>Flori Bulduș was born in 1956 in the Transylvanian commune of Mociu, in Cluj County. She completed her bachelor's and master's studies at the University of Art and Design in Cluj-Napoca, in the painting department. She lives and works in Cluj-Napoca.</p>
        <p lang="ro">${esc(ARTIST.descriptionRo)}</p>
        <h2>Artistic concept</h2>
${CONCEPT.map((p) => `        <p>${esc(p)}</p>`).join('\n')}
        <h2 id="gallery">Paintings</h2>${worksList()}
        <h2>Exhibitions</h2>
        <ul>
${exhibitions.map((ex) => `          <li><a href="/exhibitions/${esc(ex.id)}/">${esc(ex.title)}</a></li>`).join('\n')}
        </ul>${contact}`),
});
write('index.html', homeHtml);
write('404.html', homeHtml);

// --- Artworks --------------------------------------------------------------
for (const w of works) {
  const url = SITE + w.path;
  const facts = [w.technique, w.dimensions].filter(Boolean).join(', ');
  const text = paragraphs(w.description).join(' ');
  const description = truncate(`${w.name} by Romanian artist ${ARTIST.name}${facts ? ` – ${facts}` : ''}. ${text}`, 300);
  const title = `${w.name} – Painting by ${ARTIST.name}`;
  write(
    path.join('artwork', w.slug, 'index.html'),
    render({
      headHtml: head({
        title,
        description,
        path: w.path,
        image: w.images[0],
        graph: [
          personNode,
          websiteNode,
          {
            '@type': 'VisualArtwork',
            '@id': `${url}#artwork`,
            name: w.title,
            ...(w.enTitle ? { alternateName: w.enTitle } : {}),
            url,
            image: w.images.map(abs),
            description: text || undefined,
            creator: { '@id': ARTIST_ID },
            artform: 'Painting',
            ...(w.technique ? { artMedium: w.technique } : {}),
            ...(w.technique && /canvas/i.test(w.technique) ? { artworkSurface: 'Canvas' } : {}),
            ...(w.dimensions ? { size: w.dimensions } : {}),
          },
          {
            '@type': 'WebPage',
            '@id': `${url}#webpage`,
            url,
            name: title,
            description,
            isPartOf: { '@id': WEBSITE_ID },
            mainEntity: { '@id': `${url}#artwork` },
            primaryImageOfPage: abs(w.images[0]),
            breadcrumb: breadcrumb([
              [ARTIST.name, `${SITE}/`],
              [w.name, url],
            ]),
          },
        ],
      }),
      bodyHtml: body(`
        <h1>${esc(w.name)}</h1>
        <p>Painting by <a href="/">${esc(ARTIST.name)}</a>${facts ? ` · ${esc(facts)}` : ''}</p>
        <img src="/${encodeURI(w.images[0])}" alt="${esc(w.name)} – painting by ${esc(ARTIST.name)}" width="600">
${paragraphs(w.description).map((p) => `        <p>${esc(p)}</p>`).join('\n')}
        <h2>More paintings by ${esc(ARTIST.name)}</h2>${worksList(w.slug)}${contact}`),
    })
  );
}

// --- Exhibitions -----------------------------------------------------------
for (const ex of exhibitions) {
  const p = `/exhibitions/${ex.id}/`;
  const url = SITE + p;
  const title = `${ex.title} – Exhibition by ${ARTIST.name}`;
  const description = `"${ex.title}", an exhibition by Romanian visual artist ${ARTIST.name}. Listen to the artist talk about the inspiration and story behind the works (English and Romanian audio).`;
  const cover = `assets/exhibitions/${ex.id}/${ex.exhibitionCover}`;
  write(
    path.join('exhibitions', ex.id, 'index.html'),
    render({
      headHtml: head({
        title,
        description,
        path: p,
        image: cover,
        graph: [
          personNode,
          websiteNode,
          {
            '@type': 'WebPage',
            '@id': `${url}#webpage`,
            url,
            name: title,
            description,
            isPartOf: { '@id': WEBSITE_ID },
            about: { '@id': ARTIST_ID },
            primaryImageOfPage: abs(cover),
            breadcrumb: breadcrumb([
              [ARTIST.name, `${SITE}/`],
              [ex.title, url],
            ]),
          },
        ],
      }),
      bodyHtml: body(`
        <h1>${esc(ex.title)}</h1>
        <p>An exhibition by <a href="/">${esc(ARTIST.name)}</a>. ${esc(description)}</p>
        <img src="/${encodeURI(cover)}" alt="${esc(ex.title)} – exhibition by ${esc(ARTIST.name)}" width="600">
        <h2>Paintings</h2>${worksList()}${contact}`),
    })
  );
}

// --- sitemap.xml -----------------------------------------------------------
const urlEntry = (loc, images) => `  <url>
    <loc>${esc(loc)}</loc>
${images.map((img) => `    <image:image><image:loc>${esc(abs(img))}</image:loc></image:image>`).join('\n')}
  </url>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[
  urlEntry(`${SITE}/`, works.map((w) => w.images[0])),
  ...works.map((w) => urlEntry(SITE + w.path, w.images)),
  ...exhibitions.map((ex) => urlEntry(`${SITE}/exhibitions/${ex.id}/`, [`assets/exhibitions/${ex.id}/${ex.exhibitionCover}`])),
].join('\n')}
</urlset>
`;
write('sitemap.xml', sitemap);

// --- llms.txt (summary for AI assistants / AI search engines) --------------
const llms = `# ${ARTIST.name}

> ${ARTIST.descriptionEn}

Official website of the Romanian painter ${ARTIST.name} (also written "Flori Buldus"). She lives and works in ${ARTIST.city}, Romania, where she has her painting studio (${ARTIST.studio.name}, ${ARTIST.studio.street}).

## About

- Born: ${ARTIST.birthYear}, ${ARTIST.birthPlace}
- Education: BA and MA in painting, University of Art and Design of Cluj-Napoca
- Based in: ${ARTIST.city}, Romania
- Practice: abstract painting, mixed media, oil and acrylic on canvas
- Recurring symbols: the Spiral, the Circle, Fire, Water, the Pearl, the Nude
- Themes: space and time, mythology, the essence of things beyond their ordinary appearance

## Artistic concept

${CONCEPT.join('\n\n')}

## Paintings

${works
  .map((w) => {
    const facts = [w.technique, w.dimensions].filter(Boolean).join(', ');
    return `- [${w.name}](${SITE + w.path})${facts ? `: ${facts}` : ''}. ${truncate(paragraphs(w.description).join(' '), 220)}`;
  })
  .join('\n')}

## Exhibitions

${exhibitions.map((ex) => `- [${ex.title}](${SITE}/exhibitions/${ex.id}/): exhibition with artist audio commentary in English and Romanian`).join('\n')}

## Contact

- Email: ${ARTIST.email}
- Phone / WhatsApp: ${ARTIST.phoneDisplay}
- Studio: ${ARTIST.studio.name}, ${ARTIST.studio.street}, ${ARTIST.studio.city}, Romania (${ARTIST.studio.googleMaps})
${ARTIST.sameAs.map((u) => `- ${u}`).join('\n')}

## În limba română

${ARTIST.descriptionRo}
`;
write('llms.txt', llms);

console.log(
  `SEO pages generated in ${outDir}: home, ${works.length} artworks, ${exhibitions.length} exhibition(s), 404.html, sitemap.xml, llms.txt`
);
