import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Порт закреплён намеренно. Хранилище браузера (localStorage с настройками и
// ручной разметкой, IndexedDB с операциями) привязано к origin, а в origin
// входит порт. Если порт занят, Vite по умолчанию молча уходит на следующий —
// приложение открывается с пустым хранилищем, и вся ручная работа как будто
// пропала. strictPort заставляет Vite упасть с ошибкой вместо этого.
// Порты выбраны редкими: стандартный 4173 на этой машине уже занят чужим
// service worker'ом.
const DEV_PORT = 5188
const PREVIEW_PORT = 4188

// GitHub Pages отдаёт проект с подпути (avagimyan7.github.io/ameria-view/).
// Подпуть нужен сборке и её предпросмотру (vite preview отдаёт ту же сборку,
// хотя и запускается как serve). Dev-сервер остаётся в корне, иначе сменился бы
// адрес, а вместе с ним и привычная закладка.
const PAGES_BASE = '/ameria-view/'

export default defineConfig(({ command, isPreview }) => {
  const base = command === 'build' || isPreview ? PAGES_BASE : '/'
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Ameria View — мои траты',
          short_name: 'Ameria View',
          description: 'Разбор своих операций Ameriabank: сколько пришло, сколько ушло и куда',
          lang: 'ru',
          // Абсолютные '/' указывали бы на корень домена, а не на подпуть
          // GitHub Pages — «на экран Домой» открывало бы 404.
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#12141a',
          theme_color: '#12141a',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Весь код и иконки — в предкеш: приложение открывается без сети.
          // Данные сюда не попадают — они в localStorage и IndexedDB устройства.
          globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        },
      }),
    ],
    server: { port: DEV_PORT, strictPort: true },
    preview: { port: PREVIEW_PORT, strictPort: true },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}', 'test/**/*.test.{js,jsx}'],
    },
  }
})
