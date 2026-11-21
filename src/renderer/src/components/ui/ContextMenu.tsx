import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'

export interface ContextMenuItem {
  id: string
  label?: string
  icon?: React.ReactNode
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  divider?: boolean
  children?: ContextMenuItem[]
  swatches?: Array<{ color: string; hex: string; title: string; onClick: () => void }>
  onClick?: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

/**
 * Intelligent Submenu Popup with 4-way boundary collision detection,
 * automatic horizontal/vertical viewport flipping, and scroll clamping.
 * Portaled to document.body to avoid clipping by overflow-y containers.
 */
const SubmenuPopup: React.FC<{
  children: React.ReactNode
  parentItemEl: HTMLElement | null
}> = ({ children, parentItemEl }) => {
  const subRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    visibility: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0
  })

  useLayoutEffect(() => {
    const el = subRef.current
    if (!el || !parentItemEl) return

    const pad = 8
    const itemRect = parentItemEl.getBoundingClientRect()
    const subRect = el.getBoundingClientRect()
    const subWidth = subRect.width || 180
    const subHeight = subRect.height || 200

    // Horizontal placement:
    // Determine whether to open to the right or flip to the left
    const spaceRight = window.innerWidth - itemRect.right
    const spaceLeft = itemRect.left
    const openLeft = spaceRight < subWidth + pad && spaceLeft >= subWidth + pad

    const left = openLeft
      ? Math.max(pad, Math.round(itemRect.left - subWidth - 4))
      : Math.min(window.innerWidth - subWidth - pad, Math.round(itemRect.right + 4))

    // Vertical placement:
    let top = itemRect.top - 4
    if (top + subHeight + pad > window.innerHeight) {
      top = Math.max(pad, window.innerHeight - subHeight - pad)
    }
    if (top < pad) {
      top = pad
    }

    setStyle({
      visibility: 'visible',
      position: 'fixed',
      top: Math.round(top),
      left: Math.round(left),
      maxHeight: `min(420px, ${Math.max(160, window.innerHeight - 32)}px)`
    })
  }, [parentItemEl])

  return createPortal(
    <div
      ref={subRef}
      data-context-submenu="true"
      style={style}
      className="z-[105] min-w-[170px] max-w-[260px] overflow-y-auto bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-lg shadow-[0_14px_36px_rgba(0,0,0,0.4)] p-1 text-[12px] text-[var(--app-text)] select-none animate-in fade-in zoom-in-95 duration-75 custom-scrollbar"
    >
      {children}
    </div>,
    document.body
  )
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [coords, setCoords] = useState(() => {
    const pad = 10
    const estW = 220
    const estH = Math.min(items.length * 32 + 20, 360)
    return {
      left: Math.max(pad, x + estW > window.innerWidth - pad ? x - estW : x),
      top: Math.max(pad, y + estH > window.innerHeight - pad ? y - estH : y)
    }
  })
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null)

  // Clamp coordinates so the menu stays strictly inside the window viewport
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 8
    let nextLeft = x
    let nextTop = y

    // If opening near right window edge, flip to the left of target point
    if (x + rect.width > window.innerWidth - pad) {
      nextLeft = Math.max(pad, x - rect.width)
    }
    // If opening near bottom window edge, flip above target point
    if (y + rect.height > window.innerHeight - pad) {
      nextTop = Math.max(pad, y - rect.height)
    }
    setCoords({ left: nextLeft, top: nextTop })
  }, [x, y, items])

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Element
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        !target.closest?.('[data-context-submenu]')
      ) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    const handleBlur = () => onClose()

    window.addEventListener('mousedown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleBlur)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      style={{ left: coords.left, top: coords.top }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[100] min-w-[208px] max-w-[260px] max-h-[calc(100vh-24px)] overflow-y-auto bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-lg shadow-[0_14px_36px_rgba(0,0,0,0.35)] p-1 text-[12px] text-[var(--app-text)] select-none app-no-drag animate-in fade-in duration-75 custom-scrollbar"
    >
      {items.map((item) => {
        if (item.divider) {
          return <div key={item.id} className="my-1 border-t border-[var(--app-border)]" />
        }

        if (item.swatches && item.swatches.length > 0) {
          return (
            <div key={item.id} className="px-2 py-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#888888]">{item.label || 'Highlight'}</span>
              <div className="flex items-center gap-1.5">
                {item.swatches.map((s) => (
                  <button
                    key={s.color}
                    type="button"
                    title={s.title}
                    onClick={() => {
                      s.onClick()
                      onClose()
                    }}
                    className="w-4 h-4 rounded-full border border-black/40 hover:scale-110 transition-transform cursor-pointer"
                    style={{ backgroundColor: s.hex }}
                  />
                ))}
              </div>
            </div>
          )
        }

        const hasSubmenu = item.children && item.children.length > 0
        const isSubmenuOpen = activeSubmenuId === item.id

        return (
          <div
            key={item.id}
            ref={(el) => {
              if (el) itemRowRefs.current.set(item.id, el)
              else itemRowRefs.current.delete(item.id)
            }}
            className="relative"
            onMouseEnter={() => {
              if (hasSubmenu) setActiveSubmenuId(item.id)
              else setActiveSubmenuId(null)
            }}
          >
            <button
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                if (!hasSubmenu) {
                  item.onClick?.()
                  onClose()
                }
              }}
              className={`w-full h-7 px-2 rounded-[5px] flex items-center justify-between gap-3 text-left transition-colors ${
                item.disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : item.danger
                  ? 'text-[#e5484d] hover:bg-[#e5484d]/15 hover:text-[#e5484d] cursor-pointer'
                  : isSubmenuOpen
                  ? 'bg-[var(--app-surface-hover)] text-[var(--app-text-strong)] cursor-pointer'
                  : 'text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] cursor-pointer'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                {item.icon && (
                  <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 opacity-90">
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </span>

              {hasSubmenu ? (
                <ChevronRight className="w-3.5 h-3.5 text-[#888888] shrink-0" />
              ) : item.shortcut ? (
                <span className="text-[10px] text-[#8b949e] shrink-0 font-mono">
                  {item.shortcut}
                </span>
              ) : null}
            </button>

            {/* Hover Submenu with Viewport Flipping */}
            {hasSubmenu && isSubmenuOpen && (
              <SubmenuPopup parentItemEl={itemRowRefs.current.get(item.id) || null}>
                {item.children!.map((subItem) => {
                  if (subItem.divider) {
                    return <div key={subItem.id} className="my-1 border-t border-[var(--app-border)]" />
                  }
                  return (
                    <button
                      key={subItem.id}
                      type="button"
                      disabled={subItem.disabled}
                      onClick={() => {
                        if (subItem.disabled) return
                        subItem.onClick?.()
                        onClose()
                      }}
                      className={`w-full h-7 px-2 rounded-[5px] flex items-center gap-2 text-left transition-colors ${
                        subItem.disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : subItem.danger
                          ? 'text-[#e5484d] hover:bg-[#e5484d]/15 hover:text-[#e5484d] cursor-pointer'
                          : 'text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] cursor-pointer'
                      }`}
                    >
                      {subItem.icon && (
                        <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 opacity-90">
                          {subItem.icon}
                        </span>
                      )}
                      <span className="truncate">{subItem.label}</span>
                    </button>
                  )
                })}
              </SubmenuPopup>
            )}
          </div>
        )
      })}
    </div>
  )
}
