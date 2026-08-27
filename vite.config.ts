import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      /*
       * Two entry documents, one app.
       *
       * admin.html exists only to carry the install metadata in its
       * head — see the comment in that file. Both mount src/main.tsx,
       * so the router and every shared chunk are the same; the second
       * entry costs a duplicate HTML shell and nothing else.
       */
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    allowedHosts: true,
    watch: {
      /*
       * Generated poster QR codes. Nothing here is imported by the app,
       * but the dev server was watching them anyway: generating a batch
       * fired thirty hot reloads, and the watcher took the whole server
       * down with EBUSY when the folder was being zipped underneath it.
       */
      ignored: ['**/qr/**', '**/*.zip'],
    },
  },
})
