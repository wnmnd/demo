/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/demo",
  assetPrefix: "/demo/",
  images: {
    unoptimized: true
  },
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
