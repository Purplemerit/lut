import { useRef, useState } from 'react'
import { useCamera } from './camera/useCamera'
import { BeautyEngine } from './engine/BeautyEngine'
import { lookLabel, paramsForLook } from './engine/presets'
import type { BeautyParams, LookId } from './types'
import { Controls } from './ui/Controls'
import { MirrorStage } from './ui/MirrorStage'
import { PermissionGate } from './ui/PermissionGate'

export function App() {
  const camera = useCamera()
  const engineRef = useRef<BeautyEngine | null>(null)
  const [params, setParams] = useState<BeautyParams>(() => paramsForLook('soft'))
  const [toast, setToast] = useState<string | null>(null)
  const [engineError, setEngineError] = useState<string | null>(null)
  const toastTimer = useRef(0)
  const live = camera.status === 'live'

  function showToast(text: string) {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }

  function apply(next: BeautyParams) {
    setParams(next)
    engineRef.current?.setParams(next)
  }

  async function onFlip() {
    const note = await camera.flip()
    if (note) showToast(note)
  }

  async function onShutter() {
    const blob = await engineRef.current?.capture()
    if (!blob) {
      showToast('Couldn’t save that frame')
      return
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lume-${fileStamp()}.png`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
    showToast('Saved on this device')
  }

  return (
    <div className={live ? 'shell is-live' : 'shell'}>
      <MirrorStage
        camera={camera}
        engineRef={engineRef}
        params={params}
        lookName={lookLabel(params.lookId)}
        toast={toast}
        onFlip={() => void onFlip()}
        onShutter={() => void onShutter()}
        onEngineError={setEngineError}
      />
      {live ? (
        <Controls
          params={params}
          onLook={(id: LookId) => apply(paramsForLook(id))}
          onStrength={(strength) => apply({ ...params, strength })}
        />
      ) : (
        <PermissionGate status={camera.status} message={camera.message} engineError={engineError} onOpen={() => void camera.start()} />
      )}
    </div>
  )
}

function fileStamp() {
  const now = new Date()
  const part = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}-${part(now.getHours())}${part(now.getMinutes())}${part(now.getSeconds())}`
}
