import type OpenAI from 'openai'

// Extended Vercel AI Gateway parameters for reasoning/thinking models
export interface AiGatewayReasoningParams {
  max_tokens: number
}

// This type allows us to add the reasoning parameter without breaking the base types
export type AiGatewayChatCompletionCreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
  reasoning?: AiGatewayReasoningParams
}
