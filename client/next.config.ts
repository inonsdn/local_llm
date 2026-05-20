import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.34'],
  serverExternalPackages: ['@supabase/ssr'],
  webpack(config, { isServer, nextRuntime }) {
    // Only polyfill for the Node.js server build. The Edge runtime (middleware)
    // is a webworker target — setting node.__dirname there makes webpack emit
    // references to a __dirname global that doesn't exist on Edge, causing
    // "ReferenceError: __dirname is not defined" on every request.
    if (isServer && nextRuntime === 'nodejs') {
      config.node = {
        __dirname: true,
        __filename: true,
      };
    }
    return config;
  },
};

export default nextConfig;
