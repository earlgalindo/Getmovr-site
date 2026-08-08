# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This is the static marketing site for **Movr** (Get Movr), a moving / junk removal / heavy equipment transport company serving Toronto and Mississauga, hosted at `getmovr.ca`. The entire site is three static files with no build system, no package manager, and no framework:

- `index.html` — the whole site: markup, all CSS (in a single `<style>` block in `<head>`), and all JS (in a single `<script>` block before `</body>`).
- `robots.txt` — allows all crawlers, points to the sitemap.
- `sitemap.xml` — lists the single indexed URL (`https://getmovr.ca/`).

There is no `package.json`, build tooling, test suite, or linter configured. Changes are made directly to `index.html` and deployed by pushing/uploading the static files as-is.

## Development workflow

Since there's no build step, preview changes by opening the file directly or serving it locally:

```bash
# quick local preview
python3 -m http.server 8000
# then open http://localhost:8000/
```

There are no lint, test, or build commands to run — verify changes by opening the page in a browser and checking the sections affected (responsive breakpoints in particular, see below).

## Architecture of `index.html`

The page is a single scrolling landing page composed of sequential `<section>`s, each with its own CSS block grouped under a `/* ===== NAME ===== */` comment header in the same order they appear in the markup:

1. `.topbar` — sticky phone-number banner above the nav.
2. `nav` — sticky nav with logo, in-page anchor links (`#services`, `#how`, `#quote`), and a call CTA.
3. `.hero` — two-column hero (headline/CTAs + a stats card).
4. `.how` (`#how`) — 3-step "how it works" on a dark forest-green background.
5. `.services` (`#services`) — 3-card grid (Moving / Junk Removal / Heavy Equipment).
6. `.trust` — 4-item trust-signal strip.
7. `.quote` (`#quote`) — two-column contact section: call/email info + the lead-gen form.
8. `footer` — logo, tagline, footer links, copyright.

Design tokens (colors) are defined once as CSS custom properties on `:root` (`--cream`, `--forest`, `--lime`, `--gold`, etc.) — reuse these variables rather than hardcoding new colors. Two Google Fonts are used: `Fredoka` for headings/display text and `Nunito Sans` for body text, loaded via a single `<link>` in `<head>`.

Responsive behavior is handled with a handful of `@media` breakpoints (900px and 820px are the main ones) placed directly after the rules they override, following the section-by-section organization rather than being consolidated at the end of the stylesheet.

### Lead form submission

The `#quoteForm` in the `.quote` section is wired up by the inline `<script>` at the bottom of the file:

- On submit, it prevents the default action, serializes the form fields into a JSON object (`name`, `phone`, `email`, `service`, `date`, `details`, plus `submitted_at` and a fixed `source` string), and `fetch`-POSTs it as JSON to a **Make.com webhook URL** hardcoded in the script as `MAKE_WEBHOOK_URL`.
- It disables the submit button and swaps its label while the request is in flight, shows a success message and resets the form on success, and falls back to an `alert()` telling the user to call directly if the request fails.
- There is no server-side code in this repo — all lead handling happens via that external Make.com automation. If the webhook URL changes, update `MAKE_WEBHOOK_URL` in `index.html`.

### SEO / structured data

`<head>` contains meta description, canonical URL, Open Graph and Twitter Card tags, and a JSON-LD `MovingCompany` (schema.org) block describing the business (name, phone, email, service area, services offered). When changing business info that appears in the visible page (phone number, email, service area, service names), also update the corresponding values in this structured data and in the Open Graph/Twitter meta tags so they stay consistent — these are duplicated in multiple places by design (per-platform preview tags) rather than templated.

Contact info appears in several places that must be kept in sync if it changes: the `topbar`, the nav CTA (`tel:` link), the hero actions, the `.call-box` / `.email-line` in the quote section, the footer, and the JSON-LD block's `telephone`/`email` fields.
