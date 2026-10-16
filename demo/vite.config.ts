import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site builds the SDK from source, so a Cloudflare build needs no prebuild step.
const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mackeys/react': src('../packages/react/src/index.ts'),
      '@mackeys/core': src('../packages/core/src/index.ts')
    }
  },
  // The recorded clicks (base64 PCM) make one large chunk; that is expected.
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 700 }
});
