# AI Double — landing page

Angular 21 application. It is a one-to-one conversion of the previous static `index.html`
landing page: same markup, same styles, same behaviour.

## Requirements

Node.js `^20.19.0 || ^22.12.0 || >=24.0.0`.

## Local development

```bash
npm install
npm start
```

The dev server runs on http://localhost:4200.

## Production build

```bash
npm run build
```

Output goes to `dist/aidouble/browser`.

## Structure

| Path | Content |
| --- | --- |
| `src/index.html` | Document head: meta tags, Open Graph tags, Google Fonts, JSON-LD |
| `src/styles.css` | All page styles (global, unchanged from the static page) |
| `src/app/app.ts` | Root component, composes the sections |
| `src/app/reveal.ts` | `.rv` scroll-reveal directive and its shared `IntersectionObserver` |
| `src/app/nav/` | Fixed header, scroll state, mobile menu |
| `src/app/hero/` | Hero with the animated SVG hub and floating chips |
| `src/app/one-place/` | "One place for every conversation" band |
| `src/app/why/` | "Why AI Double" benefit rows |
| `src/app/trust/` | Trust section |
| `src/app/use-cases/` | Tabbed use cases |
| `src/app/how/` | "How it works" steps |
| `src/app/pricing/` | Pricing plans |
| `src/app/faq/` | FAQ |
| `src/app/download/` | App download card and QR code |
| `src/app/footer/` | Footer |
| `public/CNAME` | Custom domain `aidouble.ai`, copied into the build output |

## Deployment

`.github/workflows/deploy.yml` builds the app on every push to `main` and publishes
`dist/aidouble/browser` to GitHub Pages.

Required repository setting: **Settings > Pages > Build and deployment > Source =
GitHub Actions**.
