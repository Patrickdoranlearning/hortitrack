/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    allowedDevOrigins: [
      'https://9004-firebase-studio-1754759437684.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev'
    ],
  },
  devIndicators: {
    allowedDevOrigins: [
        '*.cloudworkstations.dev',
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
