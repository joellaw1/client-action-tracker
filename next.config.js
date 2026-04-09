/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // Required for Docker/Railway deployment
};

module.exports = nextConfig;
