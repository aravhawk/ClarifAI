import OpenAI from 'openai'
import { REASONING_TOKENS } from './constants'

export const AI_MODEL = 'anthropic/claude-haiku-4.5'
export { REASONING_TOKENS }
export const MAX_TOKENS = 8000

export function createOpenRouterClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  })
}
