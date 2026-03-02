/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse v2 uses pdfjs-dist which contains ESM-only modules that
  // crash when webpack tries to bundle them in the Node.js server context.
  // serverExternalPackages is the declarative opt-out; the webpack hook
  // below is a belt-and-suspenders fallback in case the cache is stale.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  webpack(config, { isServer }) {
    if (isServer) {
      // Explicitly mark pdf-parse and every pdfjs-dist/* subpath as a
      // native Node.js require() so webpack never tries to bundle them.
      const pdfExternals = ({ request }, callback) => {
        if (
          request === 'pdf-parse' ||
          request === 'pdfjs-dist' ||
          request?.startsWith('pdfjs-dist/')
        ) {
          return callback(null, `commonjs ${request}`)
        }
        callback()
      }

      if (Array.isArray(config.externals)) {
        config.externals.push(pdfExternals)
      } else {
        config.externals = [config.externals, pdfExternals].filter(Boolean)
      }
    }
    return config
  },
};

export default nextConfig;
