import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
