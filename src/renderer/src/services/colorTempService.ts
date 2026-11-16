// Warm Blue Light Night Filter Service (isEnableBlueFilterNight)
// Converts chromatic temperature (2000K - 4500K) to calibrated warm amber tones
// Provides hardware-independent eye-strain reduction without modifying OS display calibration

export interface WarmFilterStyle {
  backgroundColor: string
  opacity: number
}

export function kelvinToRgb(kelvin: number): { r: number; g: number; b: number } {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100

  let r: number
  let g: number
  let b: number

  // Red
  if (temp <= 66) {
    r = 255
  } else {
    r = temp - 60
    r = 329.698727446 * Math.pow(r, -0.1332047592)
    r = Math.max(0, Math.min(255, r))
  }

  // Green
  if (temp <= 66) {
    g = temp
    g = 99.4708025861 * Math.log(g) - 161.1195681661
    g = Math.max(0, Math.min(255, g))
  } else {
    g = temp - 60
    g = 288.1221695283 * Math.pow(g, -0.0755148492)
    g = Math.max(0, Math.min(255, g))
  }

  // Blue
  if (temp >= 66) {
    b = 255
  } else if (temp <= 19) {
    b = 0
  } else {
    b = temp - 10
    b = 138.5177312231 * Math.log(b) - 305.0447927307
    b = Math.max(0, Math.min(255, b))
  }

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) }
}

export function getWarmFilterOverlay(
  enabled: boolean,
  kelvin = 3200,
  intensity = 40
): WarmFilterStyle | null {
  if (!enabled || intensity <= 0) return null

  // Inverted tint to subtract blue light: we inject warm amber/candlelight
  // Lower Kelvin = warmer amber/orange
  const clampedKelvin = Math.max(2000, Math.min(4500, kelvin))
  const { r, g } = kelvinToRgb(clampedKelvin)
  const normalizedOpacity = Math.max(0.05, Math.min(0.55, (intensity / 100) * 0.45))

  return {
    backgroundColor: `rgb(${r}, ${Math.round(g * 0.85)}, 20)`,
    opacity: normalizedOpacity
  }
}
