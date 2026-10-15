# MacKeys demo site

The public site for the SDK: a sound gate, a typed intro, a playground, a localisation loop, a
style lab with a sideways shelf of finishes, and a footer made of key caps. It uses the real
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

Option A, Workers with static assets (`wrangler.jsonc`):

```bash
pnpm --dir demo deploy
```

Then add the custom domain (for example `mackeys.example.com`) to the worker under
Settings → Domains & Routes in the Cloudflare dashboard.

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
| `src/SoundGate.tsx` | First screen: asks to enable sound. The click starts the AudioContext. |
| `src/Intro.tsx` | The title types itself on a MacBook Pro, then the screen slides away. |
| `src/KeyField.tsx` | Random keys from every layout behind the whole page, shown in a circle around the pointer. |
| `src/Playground.tsx` | Type on your keyboard or click the keys. Any of the 17 layouts. |
| `src/Sdks.tsx` | The five SDKs and the spec, with install commands. |
| `src/Localisation.tsx` | A keyboard that cycles every layout and says hello in each language. |
| `src/Styles.tsx` | Finishes, backlight controls, custom themes, and the sideways 3D shelf. |
| `src/Footer.tsx` | Links and the MACKEYS wordmark made of seven key caps. |
| `src/Device.tsx` | A keyboard on its deck, built from the SDK parts, with a controller ref. |
