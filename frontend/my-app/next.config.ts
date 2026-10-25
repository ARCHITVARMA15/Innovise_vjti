import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async rewrites() {
    const fromEnv = process.env.NEXT_PUBLIC_API_URL;
    const backendUrl = fromEnv && /^https?:\/\//.test(fromEnv) ? fromEnv : 'http://localhost:8000';
    return [
      {
        source: '/backend/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
