'use client'

import { useParams } from 'next/navigation'
import { RoomProvider } from '@/hooks/useRoom'

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const roomId = params.roomId as string

  return (
    <RoomProvider roomId={roomId}>
      {children}
    </RoomProvider>
  )
}
