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
      className="fixed z-[100] min-w-[200px] max-w-[260px] bg-[#171a21] border border-[#2d323f] rounded-[2px] shadow-2xl py-1 text-[12px] text-[#e6edf3] select-none app-no-drag animate-in fade-in duration-75"
    >
      {items.map((item) => {
        if (item.divider) {
          return <div key={item.id} className="my-1 border-t border-[#232732]" />
        }

        if (item.swatches && item.swatches.length > 0) {
          return (
            <div key={item.id} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#8b949e]">{item.label || 'Highlight'}</span>
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
                    className="w-4 h-4 rounded-full border border-black/40 hover:scale-110 transition-transform"
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
            className={`w-full h-7 px-2.5 flex items-center justify-between gap-3 text-left transition-colors ${
              item.disabled
                ? 'opacity-40 cursor-not-allowed'
                : item.danger
                ? 'text-[#f85149] hover:bg-[#3d1c20] hover:text-white'
                : 'text-[#d8dee9] hover:bg-[#2a69df] hover:text-white'
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
