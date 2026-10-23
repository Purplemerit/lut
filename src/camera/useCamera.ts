import { useCallback, useEffect, useRef, useState } from 'react'

export type Facing = 'user' | 'environment'
export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'missing' | 'busy' | 'unsupported'

const RECOVERY: Record<Exclude<CameraStatus, 'idle' | 'starting' | 'live'>, string> = {
  denied: 'Camera access is off. Allow the camera for this site in the browser settings, then try again.',
  missing: 'No camera was found on this device.',
  busy: 'The camera is in use by another app. Close it, then try again.',
  unsupported: 'This browser cannot open a camera here. Try the latest Chrome, Safari, or Firefox.',
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [facing, setFacing] = useState<Facing>('user')
  const [message, setMessage] = useState<string | null>(null)

  const attach = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current
    if (!video) throw new Error('The camera view is not ready.')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await video.play()
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      setMessage(window.isSecureContext ? RECOVERY.unsupported : insecureContextMessage())
      return
    }
    setStatus('starting')
    setMessage(null)
    try {
      const stream = await openStream('user')
      streamRef.current = stream
      await attach(stream)
      setFacing('user')
      setStatus('live')
    } catch (error) {
      const next = describeCameraError(error)
      setStatus(next)
      setMessage(RECOVERY[next])
    }
  }, [attach])

  const flip = useCallback(async () => {
    const next = facing === 'user' ? 'environment' : 'user'
    try {
      const stream = await openStream(next)
      stopStream(streamRef.current)
      streamRef.current = stream
      await attach(stream)
      setFacing(next)
      return null
    } catch {
      return 'That camera isn’t available.'
    }
  }, [attach, facing])

  useEffect(() => {
    return () => stopStream(streamRef.current)
  }, [])

  return { videoRef, status, facing, message, start, flip, mirrored: facing === 'user' }
}

function insecureContextMessage() {
  const secureUrl = `https://${window.location.host}/`
  return `The camera needs a secure page. Open ${secureUrl} on this phone, or use localhost on this computer.`
}

async function openStream(facing: Facing) {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
  })
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function describeCameraError(error: unknown): Exclude<CameraStatus, 'idle' | 'starting' | 'live'> {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  return 'unsupported'
}
