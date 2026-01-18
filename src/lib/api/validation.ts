export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateMessage(message: unknown): ValidationResult {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message required' }
  }

  if (message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' }
  }

  if (message.length > 5000) {
    return { valid: false, error: 'Message too long (max 5000 characters)' }
  }

  return { valid: true }
}

export function validateToneLabels(toneLabels: unknown): ValidationResult {
  if (!toneLabels || !Array.isArray(toneLabels)) {
    return { valid: false, error: 'Tone labels required' }
  }

  if (toneLabels.length < 1 || toneLabels.length > 3) {
    return { valid: false, error: 'Between 1-3 tone labels required' }
  }

  for (const label of toneLabels) {
    if (typeof label !== 'string' || label.trim().length === 0) {
      return { valid: false, error: 'All tone labels must be non-empty strings' }
    }
    if (label.length > 50) {
      return { valid: false, error: 'Tone labels too long (max 50 characters)' }
    }
  }

  return { valid: true }
}
