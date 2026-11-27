/// <reference types="vite/client" />

import type { DesktopAPI } from '../../preload'

declare global {
  interface Window {
    desktopAPI: DesktopAPI
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        partition?: string
        allowpopups?: boolean | string
        webpreferences?: string
        useragent?: string
      }
    }
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
