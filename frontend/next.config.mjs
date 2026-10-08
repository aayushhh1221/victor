/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'export',
  // Static export: no Next.js image optimization (use plain <img>)
  images: {
    unoptimized: true,
  },
  // Trailing slash for Render static site compatibility
  trailingSlash: true,
};

export default nextConfig;
