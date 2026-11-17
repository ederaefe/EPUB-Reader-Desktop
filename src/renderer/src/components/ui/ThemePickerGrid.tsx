import React from 'react'
import { Sun, Moon, Coffee, Check } from 'lucide-react'
import type { UserSettings } from '../../db'

export type ReaderTheme = UserSettings['theme']

interface ThemeOption {
  id: ReaderTheme
  label: string
  bg: string
  text: string
  mutedLine: string
  accent: string
  border: string
  icon: 'sun' | 'moon' | 'coffee'
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'day',
    label: 'Day',
    bg: '#ffffff',
    text: '#121212',
    mutedLine: 'rgba(18, 18, 18, 0.24)',
    accent: '#005cc5',
    border: '#d0d7de',
    icon: 'sun'
  },
  {
    id: 'night',
    label: 'Night',
    bg: '#0c0c0d',
    text: '#f5f7fa',
    mutedLine: 'rgba(245, 247, 250, 0.24)',
    accent: '#8cc4ff',
    border: '#323846',
    icon: 'moon'
  },
  {
    id: 'light-sepia',
    label: 'Light sepia',
    bg: '#f5ecd8',
    text: '#1f1810',
    mutedLine: 'rgba(31, 24, 16, 0.24)',
    accent: '#6e4318',
    border: '#d8c59e',
    icon: 'coffee'
  },
  {
    id: 'dark-sepia',
    label: 'Dark sepia',
    bg: '#1f1914',
    text: '#f5ede0',
    mutedLine: 'rgba(245, 237, 224, 0.24)',
    accent: '#f3d9b8',
    border: '#4a3f32',
    icon: 'coffee'
  }
]

interface ThemePickerGridProps {
  activeTheme: ReaderTheme
  onSelect: (theme: ReaderTheme) => void
  compact?: boolean
}

export const ThemePickerGrid: React.FC<ThemePickerGridProps> = ({
  activeTheme,
  onSelect,
  compact = false
}) => {
  const renderIcon = (kind: ThemeOption['icon']) => {
    const cls = 'w-3.5 h-3.5 shrink-0'
    if (kind === 'sun') return <Sun className={cls} />
    if (kind === 'moon') return <Moon className={cls} />
    return <Coffee className={cls} />
  }

  return (
    <div
      data-preserve-theme="true"
      className="grid grid-cols-2 gap-2.5"
      role="radiogroup"
      aria-label="Reading theme"
    >
      {THEME_OPTIONS.map((t) => {
        const isActive = activeTheme === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(t.id)}
            style={{
              backgroundColor: t.bg,
              color: t.text,
              borderColor: isActive ? '#2a69df' : t.border
            }}
            className={`group relative rounded-[10px] border text-left transition-all duration-150 cursor-pointer overflow-hidden active:scale-[0.97] ${
              compact ? 'p-2.5' : 'p-3'
            } ${
              isActive
                ? 'ring-2 ring-[#2a69df]/80 ring-offset-1 ring-offset-[var(--app-surface)] shadow-md'
                : 'hover:-translate-y-[1px] hover:brightness-[1.04] hover:shadow-md'
            }`}
          >
            {/* Top Row: Mini Page Typography Specimen & Active Check */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="font-serif text-[15px] font-semibold leading-none tracking-tight shrink-0"
                  style={{ color: t.text }}
                >
                  Aa
                </span>
                <div className="flex flex-col gap-1 w-12">
                  <span
                    className="h-[2.5px] w-full rounded-full"
                    style={{ backgroundColor: t.accent }}
                  />
                  <span
                    className="h-[2px] w-9/12 rounded-full"
                    style={{ backgroundColor: t.mutedLine }}
                  />
                </div>
              </div>

              {isActive ? (
                <span
                  className="w-4 h-4 rounded-full bg-[#2a69df] text-white flex items-center justify-center shrink-0 shadow-sm"
                  aria-hidden="true"
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              ) : (
                <span
                  className="w-3.5 h-3.5 rounded-full border shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{ borderColor: t.accent, backgroundColor: t.bg }}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Bottom Row: Icon + Theme Name */}
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold leading-tight">
              <span style={{ color: t.accent }}>{renderIcon(t.icon)}</span>
              <span className="truncate">{t.label}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
