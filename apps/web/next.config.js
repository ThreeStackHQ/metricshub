/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@metricshub/db", "@metricshub/config"],
};

module.exports = nextConfig;
