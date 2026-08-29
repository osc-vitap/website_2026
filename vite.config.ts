import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      /*
       * Three entry documents, one app.
       *
       * admin.html and scan.html exist only to carry their own install
       * metadata in the head — see the comments in those files. All
       * three mount src/main.tsx, so the router and every shared chunk
       * are the same; each extra entry costs a duplicate HTML shell and
       * nothing else.
       *
       * They are separate rather than one installable app because they
       * are installed by different people: an admin onto their own
       * machine, and a volunteer onto a borrowed phone at the door. One
       * manifest would mean whoever installs second gets the other
       * one's start_url.
       */
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        scan: resolve(__dirname, 'scan.html'),
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
