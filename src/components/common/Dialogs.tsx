import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  message?: string;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  label?: string;
  initial?: string;
  okLabel?: string;
  placeholder?: string;
  /** エラーメッセージを返すと確定しない */
  validate?: (value: string) => string | null;
}

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
  /** action を渡すとボタン付きで少し長く表示する（元に戻す等） */
  toast: (message: string, action?: ToastAction) => void;
  dismissToast: () => void;
}

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

const Ctx = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; key: number; action?: ToastAction } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ kind: 'confirm', opts, resolve })),
    [],
  );
  const prompt = useCallback(
    (opts: PromptOptions) => new Promise<string | null>((resolve) => setPending({ kind: 'prompt', opts, resolve })),
    [],
  );
  const toast = useCallback(
    (text: string, action?: ToastAction) => setToastMsg({ text, key: Date.now(), action }),
    [],
  );
  const dismissToast = useCallback(() => setToastMsg(null), []);

  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), toastMsg.action ? 5000 : 2200);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  const close = () => setPending(null);

  return (
    <Ctx.Provider value={{ confirm, prompt, toast, dismissToast }}>
      {children}
      {pending?.kind === 'confirm' && (
        <ConfirmDialog
          opts={pending.opts}
          onDone={(v) => {
            pending.resolve(v);
            close();
          }}
        />
      )}
      {pending?.kind === 'prompt' && (
        <PromptDialog
          opts={pending.opts}
          onDone={(v) => {
            pending.resolve(v);
            close();
          }}
        />
      )}
      {toastMsg && (
        <div className={`toast${toastMsg.action ? ' has-action' : ''}`} role="status" key={toastMsg.key}>
          <span>{toastMsg.text}</span>
          {toastMsg.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toastMsg.action?.onClick();
                setToastMsg(null);
              }}
            >
              {toastMsg.action.label}
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useDialogs(): DialogApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('DialogProvider missing');
  return c;
}

export function Modal({
  title,
  children,
  onClose,
  footer,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">{title}</h2>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function ConfirmDialog({ opts, onDone }: { opts: ConfirmOptions; onDone: (v: boolean) => void }) {
  return (
    <Modal
      title={opts.title}
      onClose={() => onDone(false)}
      footer={
        <>
          <button className="btn" onClick={() => onDone(false)}>
            {opts.cancelLabel ?? 'キャンセル'}
          </button>
          <button className={`btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => onDone(true)} autoFocus>
            {opts.okLabel ?? 'OK'}
          </button>
        </>
      }
    >
      {opts.message && <p className="pre-wrap">{opts.message}</p>}
    </Modal>
  );
}

function PromptDialog({ opts, onDone }: { opts: PromptOptions; onDone: (v: string | null) => void }) {
  const [value, setValue] = useState(opts.initial ?? '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const submit = () => {
    const v = value.trim();
    const err = opts.validate ? opts.validate(v) : v ? null : '入力してください';
    if (err) {
      setError(err);
      return;
    }
    onDone(v);
  };
  return (
    <Modal
      title={opts.title}
      onClose={() => onDone(null)}
      footer={
        <>
          <button className="btn" onClick={() => onDone(null)}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={submit}>
            {opts.okLabel ?? '決定'}
          </button>
        </>
      }
    >
      <label className="field">
        {opts.label && <span className="field-label">{opts.label}</span>}
        <input
          ref={inputRef}
          className="input"
          value={value}
          placeholder={opts.placeholder}
          enterKeyHint="done"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
          }}
        />
      </label>
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}
