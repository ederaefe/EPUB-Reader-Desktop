import { session, type Session } from 'electron'
import { isStrictOfflineMode } from './securityBoundaryService'
import type { DictionaryLookupResponse, WikipediaLookupResponse } from '../shared/securityTypes'

const REQUEST_TIMEOUT_MS = 6000
const MAX_JSON_BYTES = 1024 * 1024 // 1 MB JSON response ceiling
const MAX_THUMBNAIL_BYTES = 512 * 1024 // 512 KB thumbnail ceiling

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

let egressSession: Session | null = null

/**
 * Checks whether an outbound URL is permitted by the strict Main-Process egress allowlist.
 * Only Google Fonts, Free Dictionary API, Wikipedia Summary REST API, and Wikimedia thumbnails are allowed.
 */
export function isAllowedMainEgressUrl(rawUrl: string): boolean {
  if (isStrictOfflineMode()) return false
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') {
      return true
    }
    if (host === 'api.dictionaryapi.dev' && parsed.pathname.startsWith('/api/v2/entries/')) {
      return true
    }
    if (host === 'en.wikipedia.org' && parsed.pathname.startsWith('/api/rest_v1/page/summary/')) {
      return true
    }
    if (host === 'upload.wikimedia.org') {
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Returns a dedicated non-renderer Electron Session used solely for allowlisted Main-process fetches.
 * Enforces a hard default-deny onBeforeRequest gate independent of the air-gapped renderer session.
 */
export function getMainEgressSession(): Session {
  if (egressSession) return egressSession
  const ses = session.fromPartition('semply-main-egress', { cache: false })
  ses.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedMainEgressUrl(details.url) })
  })
  egressSession = ses
  return ses
}

export async function mainEgressFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!isAllowedMainEgressUrl(url)) {
    throw new Error(
      isStrictOfflineMode()
        ? 'Strict Offline Mode is active — outbound network access is disabled.'
        : `Outbound request blocked by network egress allowlist: ${url}`
    )
  }
  return await getMainEgressSession().fetch(url, init)
}

function assertHttpsHostAndPrefix(
  rawUrl: string,
  allowedHost: string,
  requiredPathPrefix?: string
): URL {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(`Blocked non-HTTPS or credentialed URL: ${rawUrl}`)
  }
  if (parsed.hostname.toLowerCase() !== allowedHost) {
    throw new Error(`Blocked disallowed egress host: ${parsed.hostname}`)
  }
  if (requiredPathPrefix && !parsed.pathname.startsWith(requiredPathPrefix)) {
    throw new Error(`Blocked disallowed egress path: ${parsed.pathname}`)
  }
  return parsed
}

function assertHttpsHostSuffix(rawUrl: string, allowedSuffixes: string[]): URL {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(`Blocked non-HTTPS or credentialed URL: ${rawUrl}`)
  }
  const host = parsed.hostname.toLowerCase()
  const ok = allowedSuffixes.some((s) => host === s || host.endsWith(`.${s}`))
  if (!ok) {
    throw new Error(`Blocked disallowed host: ${host}`)
  }
  return parsed
}

async function fetchJsonStrict(
  url: string,
  allowedHost: string,
  requiredPathPrefix: string
): Promise<any | null> {
  assertHttpsHostAndPrefix(url, allowedHost, requiredPathPrefix)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const resp = await mainEgressFetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SemplyEbookReader/1.0'
      },
      signal: controller.signal
    })
    if (resp.url) {
      assertHttpsHostAndPrefix(resp.url, allowedHost, requiredPathPrefix)
    }
    if (!resp.ok) return null

    const contentType = (resp.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('application/json')) return null

    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.byteLength > MAX_JSON_BYTES) return null
    try {
      return JSON.parse(buf.toString('utf-8'))
    } catch {
      return null
    }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchWikipediaThumbnailAsDataUrl(rawThumbUrl: unknown): Promise<string | undefined> {
  if (typeof rawThumbUrl !== 'string' || !rawThumbUrl.trim()) return undefined
  let parsed: URL
  try {
    parsed = assertHttpsHostSuffix(rawThumbUrl.trim(), ['upload.wikimedia.org'])
  } catch {
    return undefined
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const resp = await mainEgressFetch(parsed.toString(), {
      headers: {
        Accept: 'image/webp,image/png,image/jpeg,image/gif,*/*;q=0.1',
        'User-Agent': 'SemplyEbookReader/1.0'
      },
      signal: controller.signal
    })
    if (resp.url) {
      assertHttpsHostSuffix(resp.url, ['upload.wikimedia.org'])
    }
    if (!resp.ok) return undefined

    const rawMime = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!ALLOWED_IMAGE_MIMES.has(rawMime)) return undefined

    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_THUMBNAIL_BYTES) return undefined
    return `data:${rawMime};base64,${buf.toString('base64')}`
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Main-process allowlisted Free Dictionary API lookup.
 * Keeps the renderer completely air-gapped from direct internet access.
 */
export async function lookupDictionaryInMain(query: string): Promise<DictionaryLookupResponse> {
  if (isStrictOfflineMode()) {
    return { ok: false, offline: true, data: null }
  }
  if (typeof query !== 'string') return { ok: true, data: null }
  const cleanWord = query.trim().split(/\s+/)[0].replace(/[^a-zA-Z-]/g, '').slice(0, 48)
  if (!cleanWord) return { ok: true, data: null }

  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`
    const data = await fetchJsonStrict(url, 'api.dictionaryapi.dev', '/api/v2/entries/')
    if (!Array.isArray(data) || data.length === 0) return { ok: true, data: null }

    const entry = data[0]
    if (!entry || typeof entry !== 'object') return { ok: true, data: null }

    return {
      ok: true,
      data: {
        word: typeof entry.word === 'string' ? entry.word : cleanWord,
        phonetic:
          typeof entry.phonetic === 'string'
            ? entry.phonetic
            : typeof entry.phonetics?.[0]?.text === 'string'
            ? entry.phonetics[0].text
            : undefined,
        meanings: Array.isArray(entry.meanings)
          ? entry.meanings
              .filter((m: any) => m && typeof m.partOfSpeech === 'string')
              .slice(0, 3)
              .map((m: any) => ({
                partOfSpeech: m.partOfSpeech,
                definitions: Array.isArray(m.definitions)
                  ? m.definitions
                      .filter((d: any) => d && typeof d.definition === 'string')
                      .slice(0, 2)
                      .map((d: any) => ({
                        definition: d.definition,
                        example: typeof d.example === 'string' ? d.example : undefined
                      }))
                  : []
              }))
          : []
      }
    }
  } catch {
    return { ok: false, data: null }
  }
}

/**
 * Main-process allowlisted Wikipedia REST API lookup + inline thumbnail proxying.
 * Returns thumbnails as base64 data URIs so the renderer never makes external image requests.
 */
export async function lookupWikipediaInMain(query: string): Promise<WikipediaLookupResponse> {
  if (isStrictOfflineMode()) {
    return { ok: false, offline: true, data: null }
  }
  if (typeof query !== 'string') return { ok: true, data: null }
  const clean = query.trim().slice(0, 60).replace(/["'?!]/g, '')
  if (!clean) return { ok: true, data: null }

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`
    const data = await fetchJsonStrict(url, 'en.wikipedia.org', '/api/rest_v1/page/summary/')
    if (!data || typeof data !== 'object' || typeof data.extract !== 'string' || !data.extract) {
      return { ok: true, data: null }
    }

    let safeContentUrl: string | undefined
    if (typeof data.content_urls?.desktop?.page === 'string') {
      try {
        safeContentUrl = assertHttpsHostSuffix(data.content_urls.desktop.page, ['wikipedia.org']).toString()
      } catch {
        safeContentUrl = undefined
      }
    }

    const thumbnailUrl = await fetchWikipediaThumbnailAsDataUrl(data.thumbnail?.source)

    return {
      ok: true,
      data: {
        title: typeof data.title === 'string' ? data.title : clean,
        description: typeof data.description === 'string' ? data.description : undefined,
        extract: data.extract,
        thumbnailUrl,
        contentUrl: safeContentUrl
      }
    }
  } catch {
    return { ok: false, data: null }
  }
}
