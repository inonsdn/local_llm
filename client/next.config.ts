import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.34'],
  serverExternalPackages: ['@supabase/ssr'],
  webpack(config, { isServer, nextRuntime }) {
    if (isServer) {
      // Next.js compiled deps (p-queue, ua-parser-js, cookie, @opentelemetry)
      // contain __dirname references. Without webpack transforming them, the
      // Edge middleware bundle throws "__dirname is not defined" at runtime.
      // Use 'true' on Node.js (real dirname) and 'mock' on Edge (literal '/').
      config.node = {
        __dirname: nextRuntime === 'edge' ? 'mock' : true,
        __filename: nextRuntime === 'edge' ? 'mock' : true,
      };
    }
    return config;
  },
};

export default nextConfig;
