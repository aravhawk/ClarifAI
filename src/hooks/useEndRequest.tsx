import { useCallback } from 'react'

export function useEndRequest(roomId: string, turnState: any, setTurnState: (state: any) => void) {
  const requestEnd = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/end`, { method: 'POST' })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to request end')
    }

    const data = await res.json()
    setTurnState(data.turnState)
  }, [roomId, setTurnState])

  const respondToEndRequest = useCallback(async (accept: boolean) => {
    const res = await fetch(`/api/rooms/${roomId}/end`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: accept ? 'accept' : 'decline' }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to respond to end request')
    }

    const data = await res.json()
    if (data.accepted) {
      return { ended: true }
    }
    if (data.turnState) {
      setTurnState(data.turnState)
    }
    return { ended: false }
  }, [roomId, setTurnState])

  const cancelEndRequest = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/end`, { method: 'DELETE' })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to cancel end request')
    }

    const data = await res.json()
    setTurnState(data.turnState)
  }, [roomId, setTurnState])

  return {
    requestEnd,
    respondToEndRequest,
    cancelEndRequest,
  }
}
