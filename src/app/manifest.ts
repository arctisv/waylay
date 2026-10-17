import type { MetadataRoute } from 'next';
import { site } from '@/config/site';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: site.name,
    short_name: site.name,
    description: site.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: site.themeColor,
    theme_color: site.themeColor,
    categories: ['productivity', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
