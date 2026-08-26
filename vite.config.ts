import vinext from "vinext";
import { defineConfig } from "vite";

// Node/VINEXT configuration.  Cloudflare bindings are intentionally not
// injected here; application data is read from the local SQLite adapter.
export default defineConfig(() => {
  const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
  return {
    resolve: { dedupe: ["react", "react-dom"] },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [vinext()],
  };
});
