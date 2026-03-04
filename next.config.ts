import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/vip-dam",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "weiheiblhxblimnjzriw.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
