import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from './Button';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info';

export interface ConfirmDialogRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  promptDefault?: string;
  promptPlaceholder?: string;
}

type DialogMode = 'confirm' | 'prompt';

type Resolver =
  | { kind: 'confirm'; resolve: (value: boolean) => void }
  | { kind: 'prompt'; resolve: (value: string | null) => void };

interface ConfirmDialogContextValue {
  openConfirm: (req: ConfirmDialogRequest) => Promise<boolean>;
  openPrompt: (req: ConfirmDialogRequest) => Promise<string | null>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

/** Imperative bridge used by `services/notifications` outside React trees. */
let bridge: ConfirmDialogContextValue | null = null;

export function getConfirmDialogBridge(): ConfirmDialogContextValue | null {
  return bridge;
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
};

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmDialogRequest | null>(null);
  const [mode, setMode] = useState<DialogMode>('confirm');
  const [promptValue, setPromptValue] = useState('');
  const resolverRef = useRef<Resolver | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  const close = useCallback((result: boolean | string | null) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    if (!resolver) return;
    if (resolver.kind === 'confirm') resolver.resolve(Boolean(result));
    else resolver.resolve(typeof result === 'string' ? result : null);
  }, []);

  const openConfirm = useCallback((req: ConfirmDialogRequest) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = { kind: 'confirm', resolve };
      setMode('confirm');
      setPromptValue('');
      setRequest({ ...req, variant: req.variant ?? 'danger' });
    });
  }, []);

  const openPrompt = useCallback((req: ConfirmDialogRequest) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = { kind: 'prompt', resolve };
      setMode('prompt');
      setPromptValue(req.promptDefault ?? '');
      setRequest({ ...req, variant: req.variant ?? 'info' });
    });
  }, []);

  useEffect(() => {
    bridge = { openConfirm, openPrompt };
    return () => {
      if (bridge?.openConfirm === openConfirm) bridge = null;
    };
  }, [openConfirm, openPrompt]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(mode === 'prompt' ? null : false);
      }
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      if (mode === 'prompt') inputRef.current?.focus();
      else cancelRef.current?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [request, mode, close]);

  const variant = request?.variant ?? 'danger';
  const style = variantStyles[variant];
  const Icon = style.icon;

  const dialog =
    request &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
        role="presentation"
      >
        <button
          type="button"
          aria-label="Dismiss dialog"
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in"
          onClick={() => close(mode === 'prompt' ? null : false)}
        />
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-fade-in"
        >
          <div className="flex gap-4">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconWrap}`}
            >
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
                      e.preventDefault();
                      close(promptValue);
                    }
                  }}
                />
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              ref={cancelRef}
              variant="outline"
              className="min-h-11"
              onClick={() => close(mode === 'prompt' ? null : false)}
            >
              {request.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={style.confirmVariant}
              className="min-h-11"
              onClick={() => close(mode === 'prompt' ? promptValue : true)}
            >
              {request.confirmLabel ?? (mode === 'prompt' ? 'Continue' : 'Confirm')}
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <ConfirmDialogContext.Provider value={{ openConfirm, openPrompt }}>
      {children}
      {dialog}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmDialogContextValue {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return ctx;
}

export default ConfirmDialogProvider;
