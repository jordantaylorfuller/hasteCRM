/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hasteCRM/database"],
  output: 'standalone',
};

module.exports = nextConfig;
