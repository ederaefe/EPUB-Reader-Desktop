import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.ederaefe.epub-reader',
  productName: 'EPUB Reader Desktop',
  directories: {
    output: 'release'
  },
  files: [
    'out/**/*'
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  },
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.productivity'
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Office'
  }
}

export default config
