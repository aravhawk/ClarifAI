import OpenAI from 'openai'
import { REASONING_TOKENS } from './constants'

export const AI_MODEL = process.env.AI_GATEWAY_MODEL ?? 'anthropic/claude-haiku-4.5'
export { REASONING_TOKENS }
export const MAX_TOKENS = 8000

export function createAiGatewayClient() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is not set')
  }

  return new OpenAI({
    baseURL: 'https://gateway.ai.vercel.com/v1',
    apiKey: process.env.AI_GATEWAY_API_KEY,
  })
}
