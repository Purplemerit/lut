import { useEffect, useRef } from 'react'
import type { BeautyParams, LookId } from '../types'
import { LOOKS } from '../engine/presets'

type ControlsProps = {
  params: BeautyParams
  onLook: (id: LookId) => void
  onStrength: (strength: number) => void
}

export function Controls({ params, onLook, onStrength }: ControlsProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const scrollSelected = () => {
      const selected = row.querySelector<HTMLElement>('.chip.is-on')
      if (!selected) return
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const left = selected.offsetLeft - (row.clientWidth - selected.clientWidth) / 2
      row.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' })
    }
    scrollSelected()
    const observer = new ResizeObserver(scrollSelected)
    observer.observe(row)
    return () => observer.disconnect()
  }, [params.lookId])

  return (
    <aside className="panel">
      <div className="panel-inner">
        <section>
          <h2>Looks</h2>
          <div className="presets" ref={rowRef} role="listbox" aria-label="Beauty looks">
            {LOOKS.map((look) => (
              <button
                key={look.id}
                type="button"
                className={look.id === params.lookId ? 'chip is-on' : 'chip'}
                aria-pressed={look.id === params.lookId}
                onClick={() => onLook(look.id)}
              >
                {look.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <Slider label="Strength" value={params.strength} onChange={onStrength} />
        </section>
        <p className="panel-note">Processed on this device.</p>
      </div>
    </aside>
  )
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = 'lume-strength'
  return (
    <label className="slider" htmlFor={id}>
      <span className="slider-label">
        <span>{label}</span>
        <span className="slider-value">{Math.round(value * 100)}</span>
      </span>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={`${label} ${Math.round(value * 100)}`}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </label>
  )
}
