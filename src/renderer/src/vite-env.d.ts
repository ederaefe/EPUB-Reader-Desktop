/// <reference types="vite/client" />

import type { DesktopAPI } from '../../preload'

declare global {
  interface Window {
    desktopAPI: DesktopAPI
  }
}

declare module '*.epub' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.svg' {
  const content: any
  export default content
}
