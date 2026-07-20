import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/task-manager/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'TaskFlow — نظام إدارة المهام',
        short_name: 'TaskFlow',
        description: 'نظام إدارة المهام والموظفين لشركة عيون الحديد',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/task-manager/',
        scope: '/task-manager/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d1017',
        theme_color: '#4f8ef7',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // نخزن ملفات التطبيق نفسها (JS/CSS/HTML) فقط للتشغيل بدون إنترنت مؤقتاً؛
        // طلبات Firebase/Firestore الحيّة ما بتتخزنش هنا عشان تفضل المزامنة اللحظية سليمة.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallbackDenylist: [/^\/task-manager\/__/],
      },
    }),
  ],
});
