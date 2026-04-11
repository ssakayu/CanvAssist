import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
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
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})