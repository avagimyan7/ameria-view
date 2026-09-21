import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Порт закреплён намеренно. Хранилище браузера (localStorage с настройками и
// ручной разметкой, IndexedDB с операциями) привязано к origin, а в origin
// входит порт. Если порт занят, Vite по умолчанию молча уходит на следующий —
// приложение открывается с пустым хранилищем, и вся ручная работа как будто
// пропала. strictPort заставляет Vite упасть с ошибкой вместо этого.
// Порты выбраны редкими: стандартный 4173 на этой машине уже занят чужим
// service worker'ом.
const DEV_PORT = 5188
const PREVIEW_PORT = 4188

export default defineConfig({
  plugins: [react()],
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: PREVIEW_PORT, strictPort: true },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}', 'test/**/*.test.{js,jsx}'],
  },
})
