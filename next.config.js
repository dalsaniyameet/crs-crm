/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Disable source maps in production — no readable code in DevTools
  productionBrowserSourceMaps: false,
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    }
    // Production: disable source maps completely
    if (!dev) {
      config.devtool = false;
      // Mangle class & function names so React component names are unreadable
      if (config.optimization && config.optimization.minimizer) {
        config.optimization.minimizer.forEach((plugin) => {
          if (plugin.constructor.name === "TerserPlugin" && plugin.options?.terserOptions) {
            plugin.options.terserOptions.compress = {
              ...plugin.options.terserOptions.compress,
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ["console.log", "console.info", "console.warn", "console.debug"],
            };
            plugin.options.terserOptions.mangle = { toplevel: true };
            plugin.options.terserOptions.output = { comments: false };
          }
        });
      }
    }
    return config;
  },
  generateBuildId: async () => {
    return Date.now().toString()
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "api.qrserver.com" },
      { protocol: "https", hostname: "cityrealspace.com" },
      { protocol: "https", hostname: "*.cityrealspace.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.cityrealspacecrm.com" }],
        destination: "https://cityrealspacecrm.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      // Public SEO pages — allow caching for Google indexing
      {
        source: "/",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          { key: "Cache-Control",          value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "Content-Security-Policy",value: "frame-ancestors 'none';" },
          { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/(free-trial|demo)",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          { key: "Cache-Control",          value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "Content-Security-Policy",value: "frame-ancestors 'none';" },
          { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Private/auth pages — no cache
      {
        source: "/(dashboard|api|sign-in|sign-up|admin-panel)(.*)",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          { key: "Cache-Control",          value: "no-store, no-cache, must-revalidate" },
          { key: "Content-Security-Policy",value: "frame-ancestors 'none';" },
          { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  poweredByHeader: false,
};
module.exports = nextConfig;
