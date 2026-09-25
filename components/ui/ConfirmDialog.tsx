import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info } from 'lucide-react'
import { Button } from './Button'

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info'

export interface ConfirmDialogRequest {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmDialogVariant
  promptDefault?: string
  promptPlaceholder?: string
  /**
   * Optional async action run when the user confirms. While it is pending the
   * dialog stays open, both buttons are disabled and the confirm button shows a
   * busy state; the dialog closes (resolving `true`) once it settles. If it
   * throws, the dialog stays open so the user can retry or cancel.
   */
  onConfirm?: () => unknown
}

type DialogMode = 'confirm' | 'prompt'

type Resolver =
  { kind: 'confirm'; resolve: (value: boolean) => void } | { kind: 'prompt'; resolve: (value: string | null) => void }

interface ConfirmDialogContextValue {
  openConfirm: (req: ConfirmDialogRequest) => Promise<boolean>
  openPrompt: (req: ConfirmDialogRequest) => Promise<string | null>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null)

/** Imperative bridge used by `services/notifications` outside React trees. */
let bridge: ConfirmDialogContextValue | null = null

export function getConfirmDialogBridge(): ConfirmDialogContextValue | null {
  return bridge
}

const variantStyles: Record<
  ConfirmDialogVariant,
  { iconWrap: string; icon: typeof AlertTriangle; confirmVariant: 'danger' | 'primary' | 'secondary' }
> = {
  danger: {
    iconWrap: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
    icon: AlertTriangle,
    confirmVariant: 'danger',
  },
  warning: {
    iconWrap: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    icon: AlertTriangle,
    confirmVariant: 'secondary',
  },
  info: {
    iconWrap: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    icon: Info,
    confirmVariant: 'primary',
  },
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmDialogRequest | null>(null)
  const [mode, setMode] = useState<DialogMode>('confirm')
  const [promptValue, setPromptValue] = useState('')
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const resolverRef = useRef<Resolver | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descId = useId()

  const setBusy = useCallback((value: boolean) => {
    pendingRef.current = value
    setPending(value)
  }, [])

  const close = useCallback(
    (result: boolean | string | null) => {
      const resolver = resolverRef.current
      resolverRef.current = null
      setBusy(false)
      setRequest(null)
      if (!resolver) return
      if (resolver.kind === 'confirm') resolver.resolve(Boolean(result))
      else resolver.resolve(typeof result === 'string' ? result : null)
    },
    [setBusy]
  )

  /** User-initiated dismissal; ignored while a confirm action is in flight. */
  const dismiss = useCallback(() => {
    if (pendingRef.current) return
    close(mode === 'prompt' ? null : false)
  }, [close, mode])

  const beginRequest = useCallback(
    (resolver: Resolver) => {
      // Settle any request that is being replaced so its caller never hangs.
      const previous = resolverRef.current
      if (previous) {
        if (previous.kind === 'confirm') previous.resolve(false)
        else previous.resolve(null)
      } else if (typeof document !== 'undefined') {
        const active = document.activeElement
        returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null
      }
      resolverRef.current = resolver
      setBusy(false)
    },
    [setBusy]
  )

  const openConfirm = useCallback(
    (req: ConfirmDialogRequest) => {
      return new Promise<boolean>((resolve) => {
        beginRequest({ kind: 'confirm', resolve })
        setMode('confirm')
        setPromptValue('')
        setRequest({ ...req, variant: req.variant ?? 'danger' })
      })
    },
    [beginRequest]
  )

  const openPrompt = useCallback(
    (req: ConfirmDialogRequest) => {
      return new Promise<string | null>((resolve) => {
        beginRequest({ kind: 'prompt', resolve })
        setMode('prompt')
        setPromptValue(req.promptDefault ?? '')
        setRequest({ ...req, variant: req.variant ?? 'info' })
      })
    },
    [beginRequest]
  )

  const handleConfirm = useCallback(async () => {
    if (pendingRef.current || !request) return
    if (mode === 'prompt') {
      close(promptValue)
      return
    }
    if (!request.onConfirm) {
      close(true)
      return
    }
    const current = resolverRef.current
    setBusy(true)
    try {
      await request.onConfirm()
    } catch (err) {
      // Leave the dialog open so the user can retry or cancel.
      if (resolverRef.current === current) setBusy(false)
      console.error('Confirm action failed', err)
      return
    }
    if (resolverRef.current === current) close(true)
  }, [request, mode, promptValue, close, setBusy])

  // Return focus to the element that opened the dialog once it closes.
  useEffect(() => {
    if (request) return
    const target = returnFocusRef.current
    returnFocusRef.current = null
    if (target && target.isConnected) target.focus()
  }, [request])

  useEffect(() => {
    bridge = { openConfirm, openPrompt }
    return () => {
      if (bridge?.openConfirm === openConfirm) bridge = null
    }
  }, [openConfirm, openPrompt])

  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        // Keep keyboard focus inside the modal dialog.
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        const inside = active instanceof Node && dialogRef.current.contains(active)
        if (e.shiftKey && (active === first || !inside)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !inside)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      if (mode === 'prompt') inputRef.current?.focus()
      else cancelRef.current?.focus()
    }, 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [request, mode, dismiss])

  const variant = request?.variant ?? 'danger'
  const style = variantStyles[variant]
  const Icon = style.icon

  const dialog =
    request &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4" role="presentation">
        <button
          type="button"
          aria-label="Dismiss dialog"
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in"
          onClick={dismiss}
        />
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          aria-busy={pending}
          className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-fade-in"
        >
          <div className="flex gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconWrap}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {request.title}
              </h2>
              <p id={descId} className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {request.message}
              </p>
              {mode === 'prompt' && (
                <input
                  ref={inputRef}
                  type="text"
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  placeholder={request.promptPlaceholder}
                  className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleConfirm()
                    }
                  }}
                />
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button ref={cancelRef} variant="outline" className="min-h-11" disabled={pending} onClick={dismiss}>
              {request.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={style.confirmVariant}
              className="min-h-11"
              loading={pending}
              onClick={() => void handleConfirm()}
            >
              {pending ? 'Processing…' : (request.confirmLabel ?? (mode === 'prompt' ? 'Continue' : 'Confirm'))}
            </Button>
          </div>
        </div>
      </div>,
      document.body
    )

  return (
    <ConfirmDialogContext.Provider value={{ openConfirm, openPrompt }}>
      {children}
      {dialog}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirmDialog(): ConfirmDialogContextValue {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  }
  return ctx
}

export default ConfirmDialogProvider
