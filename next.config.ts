// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '9004-firebase-studio-1754759437684.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev',
    '*.cloudworkstations.dev',
  ],
  experimental: {
    serverSourceMaps: false, // quiets the Firestore “Invalid source map” noise
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
}

export default nextConfig
