import { defineConfig } from "vite";

// base "./" keeps asset paths relative so the build works inside a Capacitor
// Android wrapper (Amazon Appstore) as well as on Cloudflare.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 6000,
  },
  server: { host: true },
});
