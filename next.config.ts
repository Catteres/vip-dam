import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/vip-dam",
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hfgjbcwrwxiztvrdvcbm.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
