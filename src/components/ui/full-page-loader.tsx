import { Loader2 } from 'lucide-react'

interface FullPageLoaderProps {
  title: string
  description?: string
}

export function FullPageLoader({ title, description }: FullPageLoaderProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-sage-100 flex items-center justify-center mb-8 animate-breathe">
          <Loader2 className="w-10 h-10 text-sage-500 animate-spin" />
        </div>

        <h1 className="text-2xl font-semibold text-warm-900 mb-3">
          {title}
        </h1>

        {description && (
          <p className="text-warm-600 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </main>
  )
}
