import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.34'],
  serverExternalPackages: ['@supabase/ssr'],
};

export default nextConfig;
