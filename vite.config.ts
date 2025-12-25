import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['LuckTracker.ico', 'apple-touch-icon.png', 'icon.svg'],
          manifest: {
            name: 'LuckCalendar',
            short_name: 'LuckCalendar',
            description: 'A luck tracking application',
            theme_color: '#b7edd8',
            background_color: '#f2f2f7',
            display: 'standalone',
            icons: [
              {
                src: 'icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any'
              },
              {
                src: 'icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'maskable'
              }
            ],
            categories: ["lifestyle", "productivity"],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          },
        })
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'terser',
        copyPublicDir: true
      },
      publicDir: 'public'
    };
});
