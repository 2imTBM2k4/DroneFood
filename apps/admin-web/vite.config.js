import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const appDirectory = path.dirname(fileURLToPath(import.meta.url))
const hostDependency = (name) => path.resolve(appDirectory, 'node_modules', name)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-toastify'],
    alias: {
      react: hostDependency('react'),
      'react-dom': hostDependency('react-dom'),
      'react-toastify': hostDependency('react-toastify'),
    },
  },
})
