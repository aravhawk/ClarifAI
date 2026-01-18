import type OpenAI from 'openai'

// Extended OpenRouter parameters for reasoning/thinking models
export interface OpenRouterReasoningParams {
  max_tokens: number
}

// This type allows us to add the reasoning parameter without breaking the base types
export type OpenRouterChatCompletionCreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
  reasoning?: OpenRouterReasoningParams
}
