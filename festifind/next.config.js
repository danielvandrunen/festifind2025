/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['date-fns'],
  experimental: {
    serverComponentsExternalPackages: ['date-fns'],
  },
  // Allow importing from outside the app directory
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
}

module.exports = nextConfig 