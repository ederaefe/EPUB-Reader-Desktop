import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface ContextMenuItem {
  id: string
  label?: string
  icon?: React.ReactNode
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  divider?: boolean
  swatches?: Array<{ color: string; hex: string; title: string; onClick: () => void }>
  onClick?: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ left: x, top: y })

  // Clamp coordinates so the menu stays strictly inside the window viewport
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 8
    let nextLeft = x
    let nextTop = y

    if (x + rect.width > window.innerWidth - pad) {
      nextLeft = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (y + rect.height > window.innerHeight - pad) {
      nextTop = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    setCoords({ left: nextLeft, top: nextTop })
  }, [x, y, items])

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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
      className="fixed z-[100] min-w-[208px] max-w-[260px] bg-[#111111] border border-white/[0.1] rounded-lg shadow-[0_16px_48px_rgba(0,0,0,0.75)] p-1 text-[12px] text-[#ededed] select-none app-no-drag animate-in fade-in duration-75"
    >
      {items.map((item) => {
        if (item.divider) {
          return <div key={item.id} className="my-1 border-t border-white/[0.07]" />
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

        return (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              item.onClick?.()
              onClose()
            }}
            className={`w-full h-7 px-2 rounded-[5px] flex items-center justify-between gap-3 text-left transition-colors ${
              item.disabled
                ? 'opacity-40 cursor-not-allowed'
                : item.danger
                ? 'text-[#f85149] hover:bg-[#2a1416] hover:text-[#ff7b72] cursor-pointer'
                : 'text-[#d4d4d4] hover:bg-white/[0.08] hover:text-white cursor-pointer'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              {item.icon && <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 opacity-90">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </span>
            {item.shortcut && (
              <span className="text-[10px] text-[#8b949e] shrink-0 font-mono">{item.shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
