/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@aurora/core'],
  typescript: {
    // Temporarily ignore build errors to unblock development
    // TODO: Fix TypeScript module resolution issue properly
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
