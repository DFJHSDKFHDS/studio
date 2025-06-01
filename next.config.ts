
import type {NextConfig} from 'next';

const nextConfigValues: NextConfig = {
  /* config options here */
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
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

let finalConfig: NextConfig;

if (process.env.NODE_ENV === 'development') {
  // In development (especially with Turbopack), use the plain config
  // to avoid PWA/Webpack issues that Turbopack might warn about.
  // The PWA features are not typically needed during dev server runs.
  finalConfig = nextConfigValues;
} else {
  // In production, enable PWA by wrapping the config
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    // 'disable' option is not strictly necessary here as this branch is for non-development,
    // but if you had more complex conditions, you might set it explicitly.
    // disable: false, 
  });
  finalConfig = withPWA(nextConfigValues);
}

export default finalConfig;
