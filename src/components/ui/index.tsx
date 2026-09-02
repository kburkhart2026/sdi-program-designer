import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import s from './ui.module.css'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

/* ---------- Button ---------------------------------------------------------- */

export type ButtonVariant = 'primary' | 'outline' | 'onDark' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'lg'
  block?: boolean
}

/** forwardRef so callers can return focus to the trigger after closing a menu. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'sm', block, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(s.btn, s[variant], size === 'lg' && s.lg, block && s.block, className)}
      {...rest}
    />
  )
})

/* ---------- Eyebrow ---------------------------------------------------------- */

export function Eyebrow({
  children,
  light,
  as: Tag = 'div',
  className,
  id,
}: {
  children: ReactNode
  light?: boolean
  as?: 'div' | 'h2' | 'h3'
  className?: string
  id?: string
}) {
  return (
    <Tag id={id} className={cx(s.eyebrow, light && s.eyebrowLight, className)}>
      {children}
    </Tag>
  )
}

/* ---------- Chip -------------------------------------------------------------
   Toggle chips are real buttons with aria-pressed, so their state is announced
   rather than being carried by fill colour alone. */

export function ToggleChip({
  on,
  onToggle,
  children,
  label,
}: {
  on: boolean
  onToggle: () => void
  children: ReactNode
  /** Accessible name when the visible text is an abbreviation like "CMfgT". */
  label?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      className={cx(s.chip, on && s.chipOn)}
      onClick={onToggle}
    >
      {children}
    </button>
  )
}

export function Chip({
  children,
  tone = 'default',
  title,
}: {
  children: ReactNode
  tone?: 'default' | 'on' | 'bone'
  title?: string
}) {
  return (
    <span
      title={title}
      className={cx(s.chip, s.chipStatic, tone === 'on' && s.chipOn, tone === 'bone' && s.chipBone)}
    >
      {children}
    </span>
  )
}

/* ---------- Stepper ----------------------------------------------------------
   A real spinbutton: arrow keys work, and the value is announced with its
   bounds. Shown only for Custom programs. */

export function Stepper({
  label,
  value,
  min,
  max,
  step,
  hint,
  onChange,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  hint?: string
  onChange: (next: number) => void
  disabled?: boolean
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step))
  const dec = () => onChange(clamp(value - step))
  const inc = () => onChange(clamp(value + step))
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1)

  return (
    <div className={s.stepper}>
      <Eyebrow>{label}</Eyebrow>
      <div className={s.stepperRow}>
        <button
          type="button"
          className={s.stepBtn}
          onClick={dec}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          −
        </button>
        <div
          className={s.stepValue}
          role="spinbutton"
          tabIndex={0}
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={display}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); inc() }
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); dec() }
            if (e.key === 'Home') { e.preventDefault(); onChange(min) }
            if (e.key === 'End') { e.preventDefault(); onChange(max) }
          }}
        >
          {display}
        </div>
        <button
          type="button"
          className={s.stepBtn}
          onClick={inc}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
      {hint && <div className={s.stepHint}>{hint}</div>}
    </div>
  )
}

/* ---------- Stat -------------------------------------------------------------- */

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={s.stat}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue}>{value}</div>
    </div>
  )
}

/* ---------- Card --------------------------------------------------------------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(s.card, className)}>{children}</div>
}

/* ---------- Collapsed rail -------------------------------------------------------
   A real toggle button with aria-expanded, controlling the panel it replaces. */

export function Rail({
  label,
  side,
  controls,
  onExpand,
}: {
  label: string
  side: 'left' | 'right'
  controls: string
  onExpand: () => void
}) {
  return (
    <button
      type="button"
      className={cx(s.rail, side === 'right' && s.railRight)}
      onClick={onExpand}
      aria-expanded={false}
      aria-controls={controls}
      title={`Show ${label.toLowerCase()}`}
    >
      <span className={s.railLabel}>{label}</span>
    </button>
  )
}
