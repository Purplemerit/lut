import type { CameraStatus } from '../camera/useCamera'

type PermissionGateProps = {
  status: CameraStatus
  message: string | null
  engineError: string | null
  onOpen: () => void
}

export function PermissionGate({ status, message, engineError, onOpen }: PermissionGateProps) {
  const starting = status === 'starting'
  return (
    <div className="gate">
      <div className="gate-card">
        <p className="eyebrow">Beauty mirror</p>
        <h1>Lumé</h1>
        <p className="lede">A soft-light mirror for skin, color, and glow.</p>
        <button className="primary" type="button" onClick={onOpen} disabled={starting}>
          {starting ? 'Opening camera…' : 'Open camera'}
        </button>
        <p className="privacy">Your camera stays on this device. Nothing is uploaded.</p>
        {message ? <p className="gate-error">{message}</p> : null}
        {engineError ? <p className="gate-error">{engineError}</p> : null}
      </div>
    </div>
  )
}
