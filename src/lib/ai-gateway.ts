import OpenAI from 'openai'

const LLAMA_BASE_URL = 'https://api.llama.com/compat/v1/'
const HEAVY_MODEL = 'Llama-4-Maverick-17B-128E-Instruct-FP8'
const LIGHT_MODEL = 'Llama-4-Scout-17B-16E-Instruct-FP8'
const MAX_ATTEMPTS = 3
const BACKOFF_DELAYS_MS = [1000, 2000, 4000]

export type AITaskType = 'analysis' | 'guidance' | 'tone-check' | 'coach'

type ChatCompletionsCreateParams = Parameters<OpenAI['chat']['completions']['create']>[0]
type ChatCompletionsCreateResponse = Awaited<ReturnType<OpenAI['chat']['completions']['create']>>

function getLlamaApiKey(): string {
  if (!process.env.LLAMA_API_KEY) {
    throw new Error('LLAMA_API_KEY is not set')
  }
  return process.env.LLAMA_API_KEY
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  if (!('status' in error)) return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function isRetryableError(error: unknown): boolean {
  const status = getStatusCode(error)
  return status === 429 || (typeof status === 'number' && status >= 500 && status < 600)
}

export function createAiGatewayClient() {
  return new OpenAI({
    baseURL: LLAMA_BASE_URL,
    apiKey: getLlamaApiKey(),
  })
}

export function getAiGatewayForTask(taskType: AITaskType) {
  const model = taskType === 'analysis' || taskType === 'guidance' ? HEAVY_MODEL : LIGHT_MODEL
  return {
    client: createAiGatewayClient(),
    model,
  }
}

export async function createTaskCompletion(
  taskType: AITaskType,
  params: Omit<ChatCompletionsCreateParams, 'model'>
): Promise<ChatCompletionsCreateResponse> {
  const { client, model } = getAiGatewayForTask(taskType)

  let latestError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await client.chat.completions.create({
        ...params,
        model,
      } as ChatCompletionsCreateParams)
    } catch (error) {
      latestError = error
      const canRetry = attempt < MAX_ATTEMPTS && isRetryableError(error)
      if (!canRetry) throw error
      await sleep(BACKOFF_DELAYS_MS[attempt - 1])
    }
  }

  throw latestError instanceof Error ? latestError : new Error('AI request failed')
}

export async function createTaskCompletionStream(
  taskType: Extract<AITaskType, 'coach'>,
  params: Omit<ChatCompletionsCreateParams, 'model' | 'stream'>
): Promise<ChatCompletionsCreateResponse> {
  return createTaskCompletion(taskType, {
    ...params,
    stream: true,
  } as Omit<ChatCompletionsCreateParams, 'model'>)
}
