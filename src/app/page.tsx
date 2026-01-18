import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MessageCircle, Shield, Clock, Heart } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center stagger">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-sage-100 flex items-center justify-center">
            <MessageCircle className="w-10 h-10 text-sage-500" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-semibold text-warm-900 mb-3 tracking-tight">
          ClarifAI
        </h1>
        
        <p className="text-warm-500 text-lg mb-10 leading-relaxed">
          Rehearse the hard talk.
        </p>

        {/* How it works */}
        <Card className="mb-8 bg-white/60 backdrop-blur-sm border-warm-200">
          <CardContent className="pt-6">
            <h2 className="text-sm font-medium text-warm-600 uppercase tracking-wide mb-4 text-left">
              How it works
            </h2>
            <ol className="space-y-4 text-left">
              {[
                { icon: Shield, text: 'Each person privately writes their concern' },
                { icon: MessageCircle, text: 'AI translates feelings & finds common ground' },
                { icon: Clock, text: 'Follow a guided 10-minute conversation' },
                { icon: Heart, text: 'Review fair compromises together' },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-sage-100 text-sage-500 text-sm font-medium flex items-center justify-center mt-0.5">
                    <step.icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-warm-700 text-sm leading-relaxed pt-1">
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Button asChild className="w-full h-12 text-base bg-sage-500 hover:bg-sage-400 text-white">
            <Link href="/create">Start a Session</Link>
          </Button>
          
          <Button asChild variant="outline" className="w-full h-12 text-base border-warm-300 text-warm-700 hover:bg-warm-50">
            <Link href="/join">Join with Code</Link>
          </Button>
        </div>

        {/* Footer */}
        <p className="text-warm-400 text-xs mt-8">
          Built with Gottman Method + NVC
        </p>
        
        <div className="flex justify-center gap-4 mt-4">
          <Link href="/terms" className="text-warm-400 text-xs hover:text-warm-600 underline underline-offset-2">
            Terms
          </Link>
          <Link href="/resources" className="text-warm-400 text-xs hover:text-warm-600 underline underline-offset-2">
            Resources
          </Link>
        </div>
      </div>
    </main>
  )
}
