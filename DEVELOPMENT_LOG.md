# AnalytixLabs Blog: Development & Error Log

This document tracks technical challenges, bugs, and architectural issues encountered during the development of the AnalytixLabs Blog, along with the implemented solutions. Refer to this log to avoid repeating past mistakes.

---

## 🚀 Recent Critical Fixes

### 1. Google Search Console "Soft 404" Errors
- **Issue**: Category pages (e.g., `/blog/cyber-security/`) were returning a 200 OK status but flagged as "Soft 404" by Google.
- **Cause**: **Client-side Rendering (CSR)**. The page initially sent a thin "Loading..." spinner. Googlebot often doesn't wait for async API calls to finish, seeing the page as empty.
- **Fix**: Implemented **Server-Side Rendering (SSR)**.
    - Modified `ArticlePage` and `CategoryPage` to fetch initial posts on the server.
    - Updated `CategoryView` to accept `initialPosts` and bypass the loading state if data is present.
- **Commit**: `4f0576c` (2026-05-01)

### 2. Pathing & Asset Resolution (`/blog` subpath)
- **Issue**: Assets (images, logos, scripts) and internal links were breaking in production due to the `/blog` base path.
- **Cause**: Next.js absolute paths (e.g., `/logo.svg`) resolve to the domain root, not the subpath.
- **Fix**: 
    - Created a utility `withBasePath` to automatically prefix URLs.
    - Relocated public assets into a `public/blog/` directory.
    - Updated `next.config.mjs` with `trailingSlash: true` and appropriate redirects.
- **Commits**: `18e4a22`, `2210255`, `9134729`

### 3. Light Mode Visibility & Legacy Content
- **Issue**: In light mode, some text (especially in widgets or older articles) was invisible or hard to read.
- **Cause**: Legacy WordPress content contained hardcoded inline styles (e.g., `style="color: #fff"`) that didn't adapt to themes.
- **Fix**: 
    - Implemented a "sanitization" step in the rendering pipeline to strip hardcoded `color` and `background-color` styles.
    - Standardized colors using theme-aware Tailwind classes (e.g., `text-on-surface-variant`).
- **Commits**: `df2b51a`, `c1194bf`

### 4. Tiptap Editor & Blue Text Overrides
- **Issue**: Links and widgets inside the Tiptap editor were inheriting unwanted blue colors or underlines in dark mode.
- **Cause**: Global CSS specificity issues where default browser or Tailwind styles were overriding component-level styles.
- **Fix**: 
    - Added specific CSS overrides in `TiptapEditor.css` using `!important` or higher-specificity selectors.
    - Explicitly defined colors for bold text and links in both light and dark modes.
- **Commits**: `1dc23dd`, `08c76c6`

---

## 🛠 Recurring Patterns & Best Practices

| Category | Problem | Best Practice / Fix |
| :--- | :--- | :--- |
| **SEO** | Soft 404s due to empty state | **Always** pre-fetch data on the server (SSR) for landing/category pages. |
| **Assets** | Broken images in subpath | Use `withBasePath()` utility for all images in the `public` folder. |
| **Styling** | Invisible text in themes | Avoid hardcoded HEX colors; use CSS variables or Tailwind theme colors. |
| **UX** | Layout shift during loading | Define explicit heights for loading skeletons (e.g., AskAI widget). |
| **Editor** | Content loss on save | Ensure `revalidatePath` or `revalidateTag` is called after CMS updates. |

---

## 📝 Ongoing To-Do / Monitoring
- [ ] Monitor Search Console for "Soft 404" reduction after the 2026-05-01 fix.
- [ ] Ensure all new images are placed in `public/blog/` instead of the root `public/`.
- [ ] Audit new articles for hardcoded inline styles before publishing.

---
*Last updated: 2026-05-01*
