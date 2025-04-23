/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // App directory is no longer experimental in Next.js 15
  },
  // Disable the conflicting warning
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Output standalone build for better Vercel compatibility
  output: 'standalone',
  // Resolve module path aliases
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    };
    return config;
  },
};

module.exports = nextConfig; 