# Rendering untrusted LLM markdown safely in Next.js 16 App Router

- **Issue:** #17 — how to render LLM-generated markdown lesson bodies / study sheets safely.
- **Date researched:** 2026-08-29 (all versions below are the npm `latest` tag on that date).
- **Scope:** Next.js `16.3.1`, React `19.2.8`, App Router **client** component, content is **untrusted LLM output** (XSS risk).

## Verified repo context

- `package.json` pins `next@16.3.1`, `react@19.2.8`, `react-dom@19.2.8`. Source: `/Users/fota23/levelup/package.json`.
- No markdown-rendering library is currently installed. Source: `ls node_modules | grep -iE 'markdown|remark|rehype|unified|sanitize|mdast|hast'` returns nothing.
- `AGENTS.md` directs agents to the version-matched docs bundled at `node_modules/next/dist/docs/` because Next.js 16 has breaking changes. Source: `node_modules/next/dist/docs/01-app/02-guides/ai-agents.md`.

## Recommendation (TL;DR)

Use **`react-markdown` + `rehype-sanitize` + `remark-gfm`**, pinned to:

| Package | Version |
|---|---|
| `react-markdown` | `10.1.0` |
| `rehype-sanitize` | `6.0.0` |
| `remark-gfm` | `4.0.1` |

Rationale in one line: `react-markdown` renders markdown to **React elements** (never via `dangerouslySetInnerHTML`), is already XSS-safe by default, and accepts `rehype-sanitize` as a plugin for defense-in-depth against untrusted input — this is the exact pipeline the Next.js docs themselves demonstrate.

```tsx
'use client'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

export function LessonBody({ markdown }: { markdown: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {markdown}
    </Markdown>
  )
}
```

No `dangerouslySetInnerHTML` anywhere. No extra packages needed beyond the three above — `react-markdown` pulls `unified@11`, `remark-parse@11`, `remark-rehype@11`, `mdast-util-to-hast@13`, and `hast-util-to-jsx-runtime@2` as its own dependencies, and `rehype-sanitize` pulls `hast-util-sanitize@5`.

---

## 1. Rendering options compared

### Option A — `react-markdown` (recommended)

- Current version: **`10.1.0`** (npm `latest`). Source: `npm view react-markdown version`.
- **React 19 compatibility:** peerDependencies are `{ '@types/react': '>=18', react: '>=18' }`, which React `19.2.8` satisfies. Source: `npm view react-markdown peerDependencies`. (No React 19 incompatibility; v10 is the current release line.)
- **Module format:** ESM-only (`type: module`), Node 16+. Source: `npm view react-markdown type`; README "This package is ESM only."
- **Why it's the right fit:** it converts the markdown AST (via `remark-rehype`) into a `hast` tree and then into **React elements** using `hast-util-to-jsx-runtime` — so raw HTML is never injected into the DOM. It does **not** use `dangerouslySetInnerHTML`. Source: `react-markdown` dependencies (npm view) and README architecture section.
- **Default XSS posture** (from `react-markdown` README, v10.1.0):
  - "safe by default (no `dangerouslySetInnerHTML` or XSS attacks)".
  - Raw HTML embedded in markdown is **not** rendered — "react-markdown typically escapes HTML (or ignores it, with `skipHtml`) because it is dangerous".
  - URLs are sanitized by a default `urlTransform` (`defaultUrlTransform`). Its source (`lib/index.js`) shows a protocol allowlist `const safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i`; anything with an unsafe protocol (`javascript:`, `data:`, etc.) is reduced to `''`, and protocol-relative/relative URLs are allowed. The README warns: "Overwriting `urlTransform` to something insecure will open you up to XSS vectors."
- **Controlling HTML:** `skipHtml` (default `false`; ignore HTML entirely), `allowedElements` / `disallowedElements`, `allowElement`, and `components` (per-tag React components). Source: `react-markdown` README `Options` section.
- **Plugin surface:** `remarkPlugins` and `rehypePlugins` props pass plugins straight into the unified pipeline (e.g. `rehypePlugins={[rehypeSanitize]}`). Source: README.

### Option B — `unified`/`remark`/`rehype` directly

- Versions: `unified@11.0.5`, `remark@15.0.1`, `rehype@13.0.2`, `remark-rehype@11.1.2` (npm `latest`).
- The Next.js docs show this exact low-level pipeline in their "Deep Dive" section (source: `node_modules/next/dist/docs/01-app/02-guides/mdx.md`):

  ```js
  unified()
    .use(remarkParse)      // markdown -> mdast
    .use(remarkRehype)     // mdast -> hast
    .use(rehypeSanitize)   // sanitize hast
    .use(rehypeStringify)  // hast -> HTML string
  ```

- **Trade-off vs react-markdown:** this produces an **HTML string**, which you must then inject into React with `dangerouslySetInnerHTML`. That reintroduces the "inject a sanitized string" step rather than rendering React elements directly. It's the right primitive when you need a string (e.g. server-side HTML), but for a React client component it's more code for a worse shape. `react-markdown` is built on this same stack and simply replaces the final stringify step with `hast-util-to-jsx-runtime`.

### Option C — hand-rolled renderer

- Not recommended. Correctly handling CommonMark (nested block/inline parsing, link/image reference and title syntax, escapes, code spans, HTML handling) and then emitting XSS-safe output is exactly the class of subtle, already-solved problem the `remark`/`rehype` ecosystem exists for. (Engineering judgment; no library to cite.) A hand-rolled renderer that emits HTML via `dangerouslySetInnerHTML` also forfeits the safe-by-construction property of `react-markdown`.

---

## 2. Sanitization

### `rehype-sanitize` (recommended, works in the same AST pipeline)

- Current version: **`6.0.0`**. Depends on `hast-util-sanitize@^5`. Source: `npm view rehype-sanitize version` / `dependencies`.
- ESM-only, Node 16+. Source: `rehype-sanitize` README.
- Operates on the `hast` tree (not strings), so it plugs directly into `react-markdown` via `rehypePlugins`.

**Default schema** (source: `hast-util-sanitize@5` `lib/schema.js`, which `rehype-sanitize` documents as "Follows GitHub style sanitation"):

- **Allowed elements already include everything a lesson body needs** — headings `h1`–`h6`, lists `ul`/`ol`/`li`, code `pre`/`code`, links `a`, emphasis `em`/`strong`, plus `blockquote`, `table`/`thead`/`tbody`/`tr`/`th`/`td`, `img`, `hr`, `br`, `p`, `div`, `span`, etc. **No schema customization is required for headings/lists/code/links/emphasis.**
- **`code` element** specifically allows `className` matching `/^language-./`, so syntax-highlighting classes like `language-js` survive. (General `className` on arbitrary elements is *not* in the wildcard list.)
- **Unsafe content is stripped by default:** elements not in the schema (`script`, `iframe`, `math`) are dropped (replaced by their contents); event-handler attributes (`onerror`, `onmouseover`, …) are removed; unsafe URL schemes (`javascript:`, `data:x,<script>…`) are stripped from `href`/`src`. Source: `rehype-sanitize` README "Use" example.
- **Allowed protocols:** `href` → `http, https, irc, ircs, mailto, xmpp`; `src` → `http, https`; `cite` → `http, https`. Source: `hast-util-sanitize` `lib/schema.js` `protocols`.
- **DOM clobbering defense:** every `id`/`name` attribute is rewritten with a `user-content-` prefix. Source: `rehype-sanitize` README.
- **Customizing** (only if needed): spread `defaultSchema` and override `attributes`:

  ```ts
  import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
  rehypePlugins={[[rehypeSanitize, {
    ...defaultSchema,
    attributes: { ...defaultSchema.attributes, code: [['className', /^language-./, 'math-inline']] }
  }]]}
  ```

  Source: `rehype-sanitize` README.
- **Ordering caveat:** "everything after `rehype-sanitize` could be unsafe." Run it *after* any plugin whose output you don't fully trust. Source: `rehype-sanitize` README.

### `sanitize-html` (alternative — string-based, needs `dangerouslySetInnerHTML`)

- Current version: **`2.17.7`**. Source: `npm view sanitize-html version`.
- Works on **HTML strings**: input string → sanitized string. It is CommonJS (not ESM-only). To use it with React you must first render markdown → HTML (e.g. `unified` + `rehype-stringify`, or another parser), then sanitize, then inject via `dangerouslySetInnerHTML`. Source: `sanitize-html` README.
- **Default options** (source: `sanitize-html` README, "Default options"):
  - `allowedTags` (default) includes headings `h1`–`h6`, lists `ul`/`ol`/`li`, `pre`/`code`, `em`/`strong`, `blockquote`, `table` elements, `div`/`span`/`p`/`a`, etc. — **but NOT `img`** (README comment: "We don't currently allow img itself by default"), and not `iframe`/`video` either.
  - `allowedAttributes` (default) is minimal: `a → ['href','name','target']` and `img → ['src','srcset','alt','title','width','height','loading']`. **No `class`/`id` by default**, so `language-*` classes on `<code>` would be stripped unless configured.
  - `allowedSchemes` (default): `['http','https','ftp','mailto','tel']`, with `allowProtocolRelative: true`.
  - The README itself warns: "changing the `parser` settings can be risky… If security is your goal we recommend you use the defaults."
- **Trade-off vs `rehype-sanitize`:** same end safety, but it forces the string → `dangerouslySetInnerHTML` path, and its defaults are *less* convenient for a lesson body (no `img`, no `class`), so you'd configure more. It also parses with `htmlparser2` on a string, whereas `rehype-sanitize` operates on the already-parsed AST the renderer is using.

### Post-processing / other

- Not needed given the above. The two meaningful choices are (a) sanitize on the AST (`rehype-sanitize`) or (b) sanitize the serialized string (`sanitize-html`). Sanitizing on the AST is preferred because it happens inside the same pipeline that renders React elements, with no serialization round-trip.

---

## 3. Version / compatibility summary

| Package | Latest (2026-08-29) | React 19 compat | Next 16 / ESM note |
|---|---|---|---|
| `react-markdown` | `10.1.0` | Yes — peer `react >=18` | ESM-only; bundler handles it in App Router |
| `rehype-sanitize` | `6.0.0` | N/A (AST-level, no React dep) | ESM-only |
| `remark-gfm` | `4.0.1` | N/A | ESM-only |
| `unified` | `11.0.5` | N/A | ESM-only (pulled by react-markdown) |
| `remark-rehype` | `11.1.2` | N/A | ESM-only (pulled by react-markdown) |
| `sanitize-html` | `2.17.7` | N/A (string in/out) | CommonJS |

- `react-markdown@10.1.0` peerDependencies: `{ '@types/react': '>=18', react: '>=18' }` — React `19.2.8` is in range. Source: `npm view react-markdown peerDependencies`.
- None of these libraries have a React peer dependency except `react-markdown`; the `remark`/`rehype`/`unified` packages are framework-agnostic AST transformers, so there is **no React 19 or Next 16 incompatibility** to flag.
- The only Next.js-16-specific note is that the whole remark/rehype ecosystem is ESM-only (source: `node_modules/next/dist/docs/01-app/02-guides/mdx.md`, "remark and rehype Plugins"). That matters for `next.config` plugin wiring, **not** for importing these packages inside a client component — the App Router bundler resolves ESM packages normally, so no `transpilePackages` or other config is required.

---

## 4. Next.js 16 specific guidance (from bundled docs)

- The version-matched docs are at `node_modules/next/dist/docs/` (per `AGENTS.md`). The markdown guide is `01-app/02-guides/mdx.md`.
- That guide's "Deep Dive" section demonstrates markdown → HTML transformation using `unified` + `remark-parse` + `remark-rehype` + **`rehype-sanitize`** + `rehype-stringify` — i.e. Next.js's own docs put `rehype-sanitize` in the canonical pipeline. Source: `node_modules/next/dist/docs/01-app/02-guides/mdx.md`.
- It also notes "the remark and rehype ecosystem is ESM only."
- MDX (`@next/mdx`) is **not** the right tool here: it "sources data from local files" and is for authoring-time markdown/MDX pages, not for rendering runtime LLM output in a client component. Source: same guide ("It sources data from local files").

---

## Sources

- npm registry (`npm view`), queried 2026-08-29:
  - `react-markdown` — version `10.1.0`, peerDependencies, dependencies, `type: module`
  - `rehype-sanitize` — version `6.0.0`, dependencies (`hast-util-sanitize@^5`)
  - `sanitize-html` — version `2.17.7`, dependencies, readme (default options)
  - `remark` `15.0.1`, `rehype` `13.0.2`, `unified` `11.0.5`, `remark-gfm` `4.0.1`, `remark-rehype` `11.1.2`
- `react-markdown` README (v10.1.0): https://github.com/remarkjs/react-markdown — security section, `Options` (`skipHtml`, `allowedElements`, `urlTransform`), ESM-only note, plugin usage.
- `react-markdown` source (v10.1.0) `lib/index.js`: https://github.com/remarkjs/react-markdown/blob/main/lib/index.js — `defaultUrlTransform` / `safeProtocol` allowlist.
- `rehype-sanitize` README (v6.0.0): https://github.com/rehypejs/rehype-sanitize — default schema summary, customization, ordering caveat, DOM-clobbering `user-content-` prefix.
- `hast-util-sanitize` (v5, pulled by `rehype-sanitize@6`) `lib/schema.js`: https://github.com/syntax-tree/hast-util-sanitize/blob/main/lib/schema.js — exact default `tagNames`, `attributes`, `protocols`.
- `sanitize-html` README (v2.17.7, now in the Apostrophe monorepo): https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html — "Default options".
- Next.js bundled docs (Next `16.3.1`): `node_modules/next/dist/docs/01-app/02-guides/mdx.md` and `.../ai-agents.md`.
- Repo files: `/Users/fota23/levelup/package.json`, `/Users/fota23/levelup/AGENTS.md`.
