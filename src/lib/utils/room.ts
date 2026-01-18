// Generate a random 6-character room code using safe characters
const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]
  }
  return code
}

// Format time as mm:ss
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Anonymize text by removing potential PII
export function anonymizeText(text: string): string {
  // Remove emails
  let anonymized = text.replace(/[\w.-]+@[\w.-]+\.\w+/gi, '[EMAIL]')
  
  // Remove phone numbers
  anonymized = anonymized.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]')
  
  // Remove common name patterns (capitalized words that look like names)
  // This is imperfect but helps for research purposes
  anonymized = anonymized.replace(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g, '[NAME]')
  
  return anonymized
}

// Calculate time elapsed in human-readable format
export function timeAgo(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
