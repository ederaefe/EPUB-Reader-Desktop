import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.ederaefe.semple-ebook-reader',
  productName: 'Semply Ebook Reader',
  directories: {
    output: 'release'
  },
  files: [
    'out/**/*'
  ],
  extraResources: [
    {
      from: 'resources',
      to: '.',
      filter: ['icon.ico', 'icon.png']
    }
  ],
  win: {
    icon: 'build/icon.ico',
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
    icon: 'build/icon.png',
    target: ['dmg', 'zip'],
    category: 'public.app-category.productivity'
  },
  linux: {
    icon: 'build/icon.png',
    target: ['AppImage', 'deb'],
    category: 'Office'
  }
}

export default config
