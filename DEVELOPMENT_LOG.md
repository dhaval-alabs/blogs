# AnalytixLabs Blog: Development & Error Log

This document tracks technical challenges, bugs, and architectural issues encountered during the development of the AnalytixLabs Blog, along with the implemented solutions.

---

## 🛠 New Features Implemented

### Dynamic 301/302 Redirect Management
- **Feature**: Admins can now manage URL redirects directly from the Studio.
- **Components**:
    - **Database**: `redirects` table (source, destination, type, active).
    - **Studio UI**: New `/studio/redirects` page with a table and creation form.
    - **Middleware**: Intercepts requests and applies redirects from the DB in real-time.
- **Commit**: `600ed10`

---

## 🚀 SEO & Search Engine Optimization

### Google Search Console "Soft 404" Errors
- **Issue**: Category pages (e.g., `/blog/cyber-security/`) returned 200 OK but were flagged as "Soft 404".
- **Cause**: Client-side data fetching. Googlebot saw a "Loading..." spinner instead of content.
- **Fix**: Implemented **Server-Side Rendering (SSR)** for category pages. Pre-fetch posts in `ArticlePage` and `CategoryPage`.
- **Commit**: `4f0576c`

### Duplicate FAQPage Schema
- **Issue**: Multiple FAQ schemas on a single page caused Google search validation errors.
- **Cause**: Embedded scripts in legacy content and multiple schema blocks without unique IDs.
- **Fix**: Stripped embedded scripts from content and added unique `@id` (e.g., `#faq`) to the JSON-LD block.
- **Commit**: `e268ac5`

### Indexing & Canonicalization
- **Issue**: Site was not appearing in search results; potential redirect loops on subdomain.
- **Fix**: Removed `noindex` tags. Added subdomain canonicalization redirects and handled loop prevention via `x-alabs-from-worker` header.
- **Commits**: `dbd039d`, `4dc2836`

---

## 📂 Infrastructure & Routing (`/blog` subpath)

### Base Path Asset Failures
- **Issue**: Images, logos, and scripts failed to load in production (`404 Not Found`).
- **Cause**: Next.js absolute paths resolved to domain root, bypassing the `/blog` subpath.
- **Fix**: 
    - Relocated assets to `public/blog/`.
    - Implemented `withBasePath` utility for all asset and API calls.
    - Added `trailingSlash: true` in `next.config.mjs`.
- **Commits**: `18e4a22`, `2210255`, `9134729`, `c026aa5`

### Vercel Build Errors (Static Generation)
- **Issue**: Build failed during static generation of 404 pages.
- **Cause**: `useSearchParams()` or similar hooks were used without a `Suspense` boundary.
- **Fix**: Wrapped `NavigationProgress` and other search-param-dependent components in `<Suspense>`.
- **Commit**: `d9e04e5`, `1d040f9`

---

## 🎨 UI, Theming & Legacy Content

### Light Mode Visibility (Invisible Text)
- **Issue**: Text was invisible in light mode due to legacy inline styles (`color: #fff`).
- **Fix**: Implemented a sanitization pipeline to strip hardcoded `color` and `background-color` from post content.
- **Commit**: `df2b51a`, `c1194bf`

### Tiptap Editor Styling Overrides
- **Issue**: Links/widgets inherited blue colors or underlines inconsistently.
- **Fix**: Forced explicit bold colors and link styles in `TiptapEditor.css`. Fixed "setContent" runtime bug in Tiptap v3.
- **Commits**: `1dc23dd`, `08c76c6`, `c1194bf`

### Hero Image & Glassmorphism
- **Issue**: UI felt "flat" or inconsistent on mobile.
- **Fix**: Implemented hero image blur and refined glassmorphism (12px blur, 0.7 opacity) for mobile bottom nav.
- **Commits**: `7fc5ca6`, `8aabddd`

---

## ⚙️ Backend & Database (Supabase / Actions)

### Server Action "Error Masking"
- **Issue**: Production errors in server actions were showing generic "An error occurred" messages.
- **Cause**: Next.js masks errors thrown directly in server actions for security.
- **Fix**: Replaced `throw` with structured JSON error responses and added try/catch blocks to surface real DB errors for debugging.
- **Commits**: `3abd4d1`, `9db6851`, `61e0e86`

### Like Count Synchronization
- **Issue**: Like counts didn't persist or sync correctly across the UI.
- **Fix**: Hardened DOM event handlers and ensured comment likes persist to DB with failure handling.
- **Commits**: `8411ccb`, `60ae31a`, `de5c9d4`

---

## ⚡ Performance & Optimization

### Listing Payload Size
- **Issue**: Blog listing pages were slow to load.
- **Cause**: API was returning full `content` (large HTML/MDX) for every post in the list.
- **Fix**: Modified API to use a "Lite" projection that excludes the `content` column for listing payloads.
- **Commit**: `4646a43`

### Author Fetching Overhead
- **Issue**: Multiple redundant calls to `/api/authors`.
- **Fix**: Eliminated per-page API calls by embedding author data directly in the post query.
- **Commit**: `4646a43`

---

## 🛠 Recurring Patterns (Checklist for Next Dev)

| Scenario | Strategy |
| :--- | :--- |
| **New Asset** | Must go in `public/blog/` and use `withBasePath()`. |
| **New Route** | Ensure it handles trailing slashes correctly. |
| **Search Params** | Always wrap in `<Suspense>` for build stability. |
| **Legacy HTML** | Run through `stripInlineStyles` before rendering. |
| **API Listing** | Use `.select(POST_LIST_SELECT)` to avoid heavy payload. |

---
*Last updated: 2026-05-01*
