import OpenAI from 'openai'

export const AI_MODEL = process.env.AI_GATEWAY_MODEL ?? 'minimax/minimax-m2.5:free'
export const MAX_TOKENS = 8000

export function createAiGatewayClient() {
  if (!process.env.KILO_API_KEY) {
    throw new Error('KILO_API_KEY is not set')
  }

  return new OpenAI({
    baseURL: 'https://api.kilo.ai/api/gateway',
    apiKey: process.env.KILO_API_KEY,
  })
}
