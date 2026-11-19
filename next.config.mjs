/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // keep the native-optional "pg" driver out of the webpack bundle
    serverComponentsExternalPackages: ['pg'],
  },
};

export default nextConfig;
