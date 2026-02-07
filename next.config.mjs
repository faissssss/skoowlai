/** @type {import('next').NextConfig} */
const nextConfig = {
    // Prevent 307 redirects on API routes (fixes webhook issues)
    skipTrailingSlashRedirect: true,
    experimental: {
        // React Compiler disabled due to Next.js 16 compatibility issues
        // reactCompiler: true,
        serverActions: {
            bodySizeLimit: '50mb',
        },
        // Allow large file uploads through proxy (50MB)
        proxyClientMaxBodySize: '50mb',

    },

    allowedDevOrigins: [
        "localhost:3000",
        "quartziferous-cephalate-cain.ngrok-free.dev",
    ],

    serverExternalPackages: ['openai'],
    // Enable Vercel Edge Image Optimization for external images
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com', // Common for Google Auth avatars
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com', // Common placeholder source
                pathname: '/**',
            }
        ],
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    // Strict CORS - Only allow same origin (null origin effectively blocks cross-origin unless defined)
                    // In production, this prevents unauthorized logical interaction from other domains
                    {
                        key: 'Access-Control-Allow-Origin',
                        value: process.env.NEXT_PUBLIC_APP_URL || 'null', // Fallback to null to block external access if env not set
                    },
                    {
                        key: 'Access-Control-Allow-Methods',
                        value: 'GET, POST, PUT, DELETE, OPTIONS',
                    },
                    {
                        key: 'Access-Control-Allow-Headers',
                        value: 'Content-Type, Authorization',
                    },
                    {
                        key: 'Access-Control-Allow-Credentials',
                        value: 'true',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
