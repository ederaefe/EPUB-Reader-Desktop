import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const PROD_RENDERER_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' blob:",
  "img-src 'self' data: blob: https://upload.wikimedia.org",
  "font-src 'self' data: blob:",
  "connect-src 'self' blob: data: https://api.dictionaryapi.dev https://en.wikipedia.org",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ')

// Inject strict CSP meta tag into production builds (loaded via file:// where HTTP headers do not run)
// while allowing Vite dev server HMR & React Fast Refresh to use main-process dev CSP headers cleanly.
const injectProdCspPlugin = () => ({
  name: 'semply-inject-prod-csp',
  apply: 'build' as const,
  transformIndexHtml(html: string) {
    return html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${PROD_RENDERER_CSP}" />`
    )
  }
})

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    assetsInclude: ['**/*.epub'],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src')
      }
    },
    plugins: [react(), injectProdCspPlugin()]
  }
})
