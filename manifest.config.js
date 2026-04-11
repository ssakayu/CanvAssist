import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'CanvAssist',
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  permissions: [
    'storage',
    'sidePanel',
    'tabs',
  ],
  host_permissions: [
    'https://*.instructure.com/*',
    'https://canvas.qut.edu.au/*',
  ],
  background: {
    service_worker: 'src/background.js',
    type: 'module',
  },
  action: {},
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})