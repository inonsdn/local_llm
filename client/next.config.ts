import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.34'],
  serverExternalPackages: ['@supabase/ssr'],
  webpack(config, { isServer }) {
    if (isServer) {
      // Polyfill __dirname and __filename for CJS packages running in ESM context
      config.plugins = config.plugins || [];
      config.node = {
        // __dirname: true,
        __filename: true,
      };
    }
    return config;
  },
};

export default nextConfig;
