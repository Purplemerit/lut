import { useEffect, useState, type RefObject } from 'react'
import type { useCamera } from '../camera/useCamera'
import { BeautyEngine } from '../engine/BeautyEngine'
import type { BeautyParams } from '../types'

type Camera = ReturnType<typeof useCamera>

type MirrorStageProps = {
  camera: Camera
  engineRef: RefObject<BeautyEngine | null>
  params: BeautyParams
  lookName: string
  toast: string | null
  onFlip: () => void
  onShutter: () => void
  onEngineError: (message: string) => void
}

export function MirrorStage({ camera, engineRef, params, lookName, toast, onFlip, onShutter, onEngineError }: MirrorStageProps) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const live = camera.status === 'live'

  return (
    <div className="stage">
      <video ref={camera.videoRef} className="camera-source" playsInline muted autoPlay aria-hidden="true" />
      <StageCanvas
        engineRef={engineRef}
        videoRef={camera.videoRef}
        live={live}
        mirrored={camera.mirrored}
        params={params}
        onReady={() => setReady(true)}
        onError={(message) => {
          setError(message)
          onEngineError(message)
        }}
      />
      {live ? (
        <header className="topbar">
          <p className="wordmark">Lumé</p>
          <p className="look-name">{lookName}</p>
          <div className="top-actions">
            <button className="icon-btn" type="button" aria-label="Flip camera" onClick={onFlip} disabled={!ready}>
              <FlipIcon />
            </button>
            <button className="icon-btn" type="button" aria-label="Save portrait" onClick={onShutter} disabled={!ready}>
              <ShutterIcon />
            </button>
          </div>
        </header>
      ) : null}
      {live && !ready && !error ? (
        <div className="preparing">
          <p>Preparing your mirror…</p>
        </div>
      ) : null}
      {error ? (
        <div className="preparing">
          <p>{error}</p>
        </div>
      ) : null}
      {toast ? <p className="toast">{toast}</p> : null}
    </div>
  )
}

function StageCanvas({
  engineRef,
  videoRef,
  live,
  mirrored,
  params,
  onReady,
  onError,
}: {
  engineRef: RefObject<BeautyEngine | null>
  videoRef: RefObject<HTMLVideoElement | null>
  live: boolean
  mirrored: boolean
  params: BeautyParams
  onReady: () => void
  onError: (message: string) => void
}) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [engineReady, setEngineReady] = useState(false)

  useEffect(() => {
    if (!canvas) return
    const engine = new BeautyEngine(canvas)
    engineRef.current = engine
    let cancel = false
    engine.init().then(() => {
      if (cancel) return
      setEngineReady(true)
      onReady()
    }).catch((error: unknown) => {
      if (cancel) return
      onError(error instanceof Error ? error.message : 'The mirror could not start.')
    })
    return () => {
      cancel = true
      setEngineReady(false)
      engine.destroy()
      if (engineRef.current === engine) engineRef.current = null
    }
    // Create the engine once for this canvas. Later effects push new settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, engineRef])

  useEffect(() => {
    engineRef.current?.setParams(params)
  }, [engineRef, params])

  useEffect(() => {
    engineRef.current?.setMirrored(mirrored)
  }, [engineRef, mirrored])

  useEffect(() => {
    const engine = engineRef.current
    const video = videoRef.current
    if (!engineReady || !live || !engine || !video) return
    engine.start(video)
    return () => engine.stop()
  }, [engineReady, engineRef, live, videoRef])

  return <canvas ref={setCanvas} className="stage-canvas" aria-label="Live beauty mirror" />
}

function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7H5.5A3.5 3.5 0 0 0 2 10.5V14M16 17h2.5A3.5 3.5 0 0 0 22 13.5V10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 3.5 5.2 7 8 10.5M16 13.5 18.8 17 16 20.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function ShutterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.1" fill="currentColor" />
    </svg>
  )
}
