# MacKeys demo site

The public site for the SDK: a typed intro, a sideways slider of 23 styles, a languages loop,
install panel, and a footer made of key caps. `/demo` is a typing test, and the site serves `llms.txt`. It uses the real
`@mackeys/react` components and the recorded click sounds.

The site builds the SDK from source (`packages/core/src`, `packages/react/src`), so a deploy needs
no prebuild step.

## Run

```bash
pnpm install
```

```bash
pnpm --dir demo dev
```

The dev server runs on http://localhost:5176.

## Build

```bash
pnpm --dir demo build
```

The static site lands in `demo/dist`.

## Deploy to Cloudflare

Option A, [Void](https://void.cloud) to your own Cloudflare account. `void.config.ts` holds the Worker
name, the account and the SPA fallback; commit it with `void.lock.json`.

```bash
pnpm --dir demo deploy
```

The site runs at https://mackeys.perwko.com. To add a custom domain, run this in `demo/`:

```bash
npx void domain add mackeys.example.com
```

Option B, Cloudflare Pages or Workers Builds connected to the GitHub repository:

| Setting | Value |
| --- | --- |
| Root directory | `/` |
| Build command | `pnpm install && pnpm --dir demo build` |
| Build output directory | `demo/dist` |
| Node version | 22 |

Add the subdomain under Custom domains. Cloudflare creates the DNS record when the zone is on
Cloudflare.

## Structure

| File | Section |
| --- | --- |
| `src/Intro.tsx` | The title types itself on a MacBook Pro, then the screen slides away. |
| `src/KeyField.tsx` | Random keys from every layout behind the whole page, shown in a circle around the pointer. |
| `src/Presets.tsx` | Top of the page: a sideways slider of every style. The middle keyboard is big, tilted and live. Horizontal scroll, drag or click only; vertical scroll stays with the page. |
| `src/Localisation.tsx` | A keyboard that morphs through every layout and types a greeting in each language, only while all of it is on screen. |
| `src/Sdks.tsx` | Key cap tabs for React, Svelte, Swift and Rust, a MacBook top case in one color for each, and the install command. |
| `src/TypingDemo.tsx` | The typing test at `/demo` (`src/main.tsx` picks the page from the path). The keyboard is the SDK keyboard with its sounds. |
| `src/Footer.tsx` | Links and the MACKEYS wordmark made of seven key caps. |
| `src/links.ts` | The GitHub and typing demo links. |
| `public/llms.txt` | A short guide to the SDK for language models. |
| `src/Device.tsx` | A keyboard on its deck, built from the SDK parts, with a controller ref. |
