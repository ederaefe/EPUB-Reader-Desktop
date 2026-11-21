/**
 * @type {import('electron-builder').Configuration}
 */
const hasAzureSigning = Boolean(
  process.env.AZURE_SIGN_ENDPOINT &&
    process.env.AZURE_SIGN_ACCOUNT_NAME &&
    process.env.AZURE_SIGN_PROFILE_NAME
)

const hasAppleNotarizeCreds = Boolean(
  (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) ||
    (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID)
)

const config = {
  appId: 'com.ederaefe.semply-ebook-reader',
  productName: 'Semply Ebook Reader',
  copyright: 'Copyright (c) 2026 Efedera (efedera.me). Licensed under the MIT License.',
  asar: true,
  asarUnpack: ['**/node_modules/mupdf/**/*', '**/*.wasm'],
  directories: {
    buildResources: 'build',
    output: 'release'
  },
  files: ['out/**/*'],
  extraResources: [
    {
      from: 'resources',
      to: '.',
      filter: ['icon.ico', 'icon.png']
    }
  ],
  fileAssociations: [
    {
      ext: 'epub',
      name: 'EPUB eBook',
      description: 'Open EPUB eBook with Semply Ebook Reader',
      mimeType: 'application/epub+zip',
      role: 'Viewer'
    },
    {
      ext: 'pdf',
      name: 'PDF Document',
      description: 'Open PDF Document with Semply Ebook Reader',
      mimeType: 'application/pdf',
      role: 'Viewer'
    }
  ],
  publish: [
    {
      provider: 'github',
      owner: 'ederaefe',
      repo: 'EPUB-Reader-Desktop',
      releaseType: 'release'
    }
  ],
  win: {
    icon: 'build/icon.ico',
    requestedExecutionLevel: 'asInvoker',
    publisherName: 'Efedera',
    signtoolOptions: {
      signingHashAlgorithms: ['sha256'],
      rfc3161TimeStampServer: 'http://timestamp.digicert.com',
      timeStampServer: 'http://timestamp.digicert.com',
      publisherName: 'Efedera'
    },
    ...(hasAzureSigning
      ? {
          azureSignOptions: {
            endpoint: process.env.AZURE_SIGN_ENDPOINT,
            codeSigningAccountName: process.env.AZURE_SIGN_ACCOUNT_NAME,
            certificateProfileName: process.env.AZURE_SIGN_PROFILE_NAME,
            ...(process.env.WIN_PUBLISHER_NAME
              ? { publisherName: process.env.WIN_PUBLISHER_NAME }
              : {})
          }
        }
      : {}),
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      },
      {
        target: 'portable',
        arch: ['x64']
      }
    ]
  },
  nsis: {
    artifactName: 'Semply-Ebook-Reader-${version}-win-${arch}-setup.${ext}',
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Semply Ebook Reader',
    uninstallDisplayName: 'Semply Ebook Reader (by Efedera)'
  },
  portable: {
    artifactName: 'Semply-Ebook-Reader-${version}-win-${arch}-portable.${ext}'
  },
  mac: {
    icon: 'build/icon.png',
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    identity: null,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.inherit.plist',
    notarize: hasAppleNotarizeCreds,
    artifactName: 'Semply-Ebook-Reader-${version}-mac-${arch}.${ext}',
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64']
      },
      {
        target: 'zip',
        arch: ['arm64', 'x64']
      }
    ]
  },
  dmg: {
    title: 'Semply Ebook Reader ${version}'
  },
  linux: {
    icon: 'build/icon.png',
    category: 'Office',
    maintainer: 'Efedera <https://efedera.me>',
    synopsis: 'Fast, local-first EPUB and PDF desktop reader with offline MuPDF reflow',
    artifactName: 'Semply-Ebook-Reader-${version}-linux-${arch}.${ext}',
    desktop: {
      entry: {
        Name: 'Semply Ebook Reader',
        Comment: 'Clean, open cross-platform EPUB and PDF reader',
        Categories: 'Office;Viewer;Education;',
        MimeType: 'application/epub+zip;application/pdf;'
      }
    },
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'deb',
        arch: ['x64']
      }
    ]
  }
}

module.exports = config
