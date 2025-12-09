import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://www.skoowlai.com'

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',           // API routes - no crawling
                    '/dashboard/',     // Private dashboard - requires auth
                    '/study/',         // Private study pages - requires auth
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
