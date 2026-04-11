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
    'sidePanel',
    'contentSettings',
    'storage',
    'tabs',
    'scripting',
  ],
  host_permissions: ['https://canvas.qut.edu.au/*'],
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [{
    js: ['src/content/main.jsx'],
    matches: ['https://canvas.qut.edu.au/*'],
  }],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
