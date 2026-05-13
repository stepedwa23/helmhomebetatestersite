import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Stamped once at server start. Used by src/lib/devReset.ts to detect a
// fresh `npm run dev` vs. a within-session page refresh.
const DEV_BOOT_ID = Date.now().toString()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __DEV_BOOT_ID__: JSON.stringify(DEV_BOOT_ID),
  },
})
