# Public website languages

Spanish is the default at the existing URLs. English uses the same paths with `/en`, for example `/en/desarrollos/feel-palermo`. The header selector preserves the current path, query and anchor. Public links retain the selected language. The language is URL-based: returning directly to `/` starts in Spanish.

## One source of content

The original Spanish React pages and catalog records remain the source. English text is applied after hydration without adding wrappers or changing React's element structure. The observer also handles newly rendered descriptions, filters, dialogs, labels, placeholders and alternative text. User-entered input values, editable fields, code, scripts and private pages are excluded. Private agent-only listing content is explicitly excluded. Existing images, videos and external PDF files are not rewritten.

English pages preload the cache entries derived from published public pages, avoiding a separate translation request for known content. The preload allowlist excludes arbitrary API submissions; newly changed strings still translate on demand using their new source key.

Translations are cached in `public_site_translations`, keyed by the source text and translation version. A changed source automatically requests a new translation. Shared labels have an instant local dictionary; other copy is translated by the server using the existing `GROQ_API_KEY`, with a fallback model and no key exposed to the browser. The first request for new text may take a few seconds; an unavailable service leaves the original visible and offers Retry.

Numbers, currencies, measurements, project names and URLs are protected before generation. The server rejects outputs that omit/duplicate protected values, add numbers or add HTML. Public project names are loaded from the catalog, so newly created developments are also protected. No currency conversion is performed.

## Boundaries

`/api/public/translations` validates origin and request size. Generation has persistent per-client/hour and global/day character limits. Cache hits do not consume generation budget. RLS is enabled on both cache and usage tables. Admin, CRM, authentication, upload, quotation and meeting pages do not enter the public language flow. Middleware still replaces the admin return-path header itself.

English pages set `lang=en`, English metadata and language alternates. Spanish retains its canonical URL. Visible page text is translated client-side; metadata is translated on the server. This is not a separately authored English catalog.

## Verification

`node --test tests/site-language.test.cjs` covers language routing, private-route exclusion, immutable numbers/brands, source-change invalidation, cache reuse, endpoint validation and server-rendered selector state. DOM mutation/form tests also run when Happy DOM is installed under `work/i18n-test`:

```sh
npm install --prefix work/i18n-test --no-save happy-dom
node --test tests/site-language.test.cjs
```

Use `/en/desarrollos` and an individual development to check navigation, selector state, loaded dynamic content and the Spanish return path. Existing translations can be warmed through the public translation endpoint without maintaining duplicate text records.
