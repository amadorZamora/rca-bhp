import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Obtener git commit hash corto
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

const getGitDate = () => {
  try {
    return execSync('git log -1 --format=%cd --date=format:"%d/%m/%Y"').toString().trim()
  } catch {
    return new Date().toLocaleDateString('es-CL')
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __GIT_HASH__:    JSON.stringify(getGitHash()),
    __GIT_DATE__:    JSON.stringify(getGitDate()),
  }
})