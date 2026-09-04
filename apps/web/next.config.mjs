/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@talentshowcase/types'],
  // Proxy API calls made from the browser through the web server so the
  // deployment only needs to expose one origin. Direct API_URL override wins.
  async rewrites() {
    const apiPort = process.env.API_PORT ?? '4000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `http://localhost:${apiPort}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
