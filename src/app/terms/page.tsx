import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <Link href="/" className="inline-flex items-center gap-2 text-warm-500 hover:text-warm-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Link>

        <h1 className="text-3xl font-semibold text-warm-900 mb-8">Terms of Service</h1>

        <div className="prose prose-warm max-w-none">
          <p className="text-warm-600 leading-relaxed mb-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <h2 className="text-xl font-semibold text-warm-900 mt-8 mb-4">1. About ClarifAI</h2>
          <p className="text-warm-600 leading-relaxed mb-4">
            ClarifAI is a communication tool designed to help couples and roommates prepare for 
            difficult conversations. It uses AI to analyze perspectives, identify underlying needs, 
            and suggest constructive approaches to conflict resolution.
          </p>

          <h2 className="text-xl font-semibold text-warm-900 mt-8 mb-4">2. Not a Substitute for Professional Help</h2>
          <p className="text-warm-600 leading-relaxed mb-4">
            ClarifAI is not a replacement for professional therapy, counseling, or medical advice. 
            If you are experiencing domestic violence, abuse, or mental health crises, please contact 
            appropriate emergency services or the resources listed on our{' '}
            <Link href="/resources" className="text-sage-600 underline">Resources page</Link>.
          </p>

          <h2 className="text-xl font-semibold text-warm-900 mt-8 mb-4">3. Privacy & Data</h2>
          <p className="text-warm-600 leading-relaxed mb-4">
            <strong>What we collect:</strong> The text you enter during sessions, along with 
            anonymous usage data (session duration, features used, etc.).
          </p>
          <p className="text-warm-600 leading-relaxed mb-4">
            <strong>How we use it:</strong> Your session data is processed by AI to generate 
            insights. Anonymized data (with personal identifiers removed) may be used for 
            research to improve relationship communication tools.
          </p>
          <p className="text-warm-600 leading-relaxed mb-4">
            <strong>Data retention:</strong> Session data is automatically deleted 7 days after 
            completion. Anonymized research data is retained indefinitely.
          </p>
          <p className="text-warm-600 leading-relaxed mb-4">
            <strong>Third parties:</strong> Your data is processed by our AI provider (Anthropic/Claude 
            via Vercel AI Gateway). We may share or sell anonymized, aggregated datasets for research, analytics, or commercial purposes.
          </p>

          <h2 className="text-xl font-semibold text-warm-900 mt-8 mb-4">4. User Conduct</h2>
          <p className="text-warm-600 leading-relaxed mb-4">
            You agree not to use ClarifAI to:
          </p>
          <ul className="list-disc pl-6 text-warm-600 mb-4 space-y-2">
            <li>Threaten, harass, or abuse others</li>
            <li>Manipulate or coerce your partner</li>
            <li>Plan or coordinate harmful activities</li>
            <li>Circumvent safety features</li>
          </ul>

          <h2 className="text-xl font-semibold text-warm-900 mt-8 mb-4">5. Safety Features</h2>
          <p className="text-warm-600 leading-relaxed mb-4">
            ClarifAI includes safety detection systems. If concerning content is detected, 
            sessions may be paused and resources provided. This is for your protection 
            and the protection of others.
          </p>

          <h2 className="text-xl font-semibold text-warm-900 mt-8 mb-4">6. Limitations of Liability</h2>
          <p className="text-warm-600 leading-relaxed mb-4">
            ClarifAI is provided &ldquo;as is&rdquo; without warranties of any kind. We are not 
            responsible for outcomes of conversations or decisions made based on AI suggestions.
          </p>

          <h2 className="text-xl font-semibold text-warm-900 mt-8 mb-4">7. Research Consent</h2>
          <p className="text-warm-600 leading-relaxed mb-4">
            By using ClarifAI, you consent to the collection of anonymized data for research 
            purposes. This data helps improve communication tools and contributes to 
            relationship science. No personally identifiable information is included in 
            research datasets.
          </p>

          <h2 className="text-xl font-semibold text-warm-900 mt-8 mb-4">8. Contact</h2>
          <p className="text-warm-600 leading-relaxed mb-4">
            For questions about these terms or your data, please contact us through 
            the appropriate channels.
          </p>
        </div>

        <div className="mt-12">
          <Button asChild variant="outline" className="border-warm-300">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
