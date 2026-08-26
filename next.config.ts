import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Media uploads are streamed through App Router handlers. Keep the
  // framework request limit aligned with the media API's own 8 MB validator;
  // otherwise VINEXT rejects valid images before the handler can validate or
  // store them.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
