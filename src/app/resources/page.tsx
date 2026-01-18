import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, ExternalLink, Heart, Home } from 'lucide-react'

export default function ResourcesPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-sage-100 flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-sage-500" />
          </div>
          <h1 className="text-2xl font-semibold text-warm-900 mb-2">
            Support Resources
          </h1>
          <p className="text-warm-500">
            If you or someone you know needs help, these resources are available 24/7.
          </p>
        </div>

        {/* Crisis resources */}
        <div className="space-y-4 mb-8">
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-amber-900 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                988 Suicide & Crisis Lifeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-amber-800 text-sm mb-3">
                Free, confidential support for people in distress. Available 24/7.
              </p>
              <a 
                href="tel:988"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-200 text-amber-900 rounded-lg font-medium text-sm hover:bg-amber-300 transition-colors"
              >
                Call or Text 988
              </a>
            </CardContent>
          </Card>

          <Card className="border-warm-200 bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-warm-900 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                National Domestic Violence Hotline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-warm-600 text-sm mb-3">
                Confidential support for anyone affected by domestic violence.
              </p>
              <div className="flex flex-wrap gap-2">
                <a 
                  href="tel:1-800-799-7233"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-warm-100 text-warm-800 rounded-lg font-medium text-sm hover:bg-warm-200 transition-colors"
                >
                  1-800-799-7233
                </a>
                <a 
                  href="https://www.thehotline.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-warm-100 text-warm-800 rounded-lg font-medium text-sm hover:bg-warm-200 transition-colors"
                >
                  thehotline.org
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          <Card className="border-warm-200 bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-warm-900 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Crisis Text Line
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-warm-600 text-sm mb-3">
                Text-based support for any type of crisis. Free and confidential.
              </p>
              <a 
                href="sms:741741?body=HELLO"
                className="inline-flex items-center gap-2 px-4 py-2 bg-warm-100 text-warm-800 rounded-lg font-medium text-sm hover:bg-warm-200 transition-colors"
              >
                Text HOME to 741741
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Important note */}
        <Card className="mb-8 bg-sage-50 border-sage-200">
          <CardContent className="py-4">
            <p className="text-sage-800 text-sm text-center">
              <strong>Important:</strong> ClarifAI is not a substitute for professional therapy or counseling. 
              If you&apos;re experiencing ongoing relationship difficulties, please consider speaking with a licensed professional.
            </p>
          </CardContent>
        </Card>

        {/* Back button */}
        <Button asChild variant="outline" className="w-full h-12 border-warm-300">
          <Link href="/">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>
      </div>
    </main>
  )
}
