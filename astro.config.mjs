// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://npprov.se',
  integrations: [sitemap({
    filter: (page) => !page.includes('/moderera') && !page.includes('/api/'),
  })],
  
  vite: {
    plugins: [tailwindcss()],
  },
  
  // Prestanda & SEO
  build: {
    inlineStylesheets: 'auto',
  },
  
  // Hybrid rendering: de flesta sidor static, men moderera + API är dynamiska
  output: 'static',
  adapter: vercel(),
});
