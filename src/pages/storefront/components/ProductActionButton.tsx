import { MouseEvent, ReactNode, useEffect, useRef, useState } from "react";

interface ProductActionButtonProps {
  added: boolean;
  disabled?: boolean;
  onConfirm?: () => void | Promise<void>;
  children?: ReactNode;
}

export function ProductActionButton({ added, disabled, onConfirm, children }: ProductActionButtonProps) {
  const [selfAdded, setSelfAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetRef.current) {
        clearTimeout(resetRef.current);
      }
      if (confirmRef.current) {
        clearTimeout(confirmRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (added) {
      if (resetRef.current) {
        clearTimeout(resetRef.current);
        resetRef.current = null;
      }
      if (confirmRef.current) {
        clearTimeout(confirmRef.current);
        confirmRef.current = null;
      }
      setSelfAdded(false);
      setPending(false);
    }
  }, [added]);

  const showAdded = added || selfAdded;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled || pending) {
          event.currentTarget.blur();
          return;
        }
        event.currentTarget.blur();
        if (!added || !selfAdded) {
          setSelfAdded(true);
          if (resetRef.current) {
            clearTimeout(resetRef.current);
          }
          resetRef.current = setTimeout(() => {
            setSelfAdded(false);
            resetRef.current = null;
          }, 2500);
        }
        setPending(true);
        if (confirmRef.current) {
          clearTimeout(confirmRef.current);
        }
        confirmRef.current = setTimeout(() => {
          confirmRef.current = null;
          Promise.resolve(onConfirm?.()).finally(() => {
            setPending(false);
          });
        }, 2500);
      }}
      disabled={disabled || pending}
      className={`inline-flex w-full items-center justify-center rounded-full px-3 py-2 text-xs font-semibold text-white transition duration-300 ${
        showAdded
          ? "bg-emerald-500 shadow-[0_12px_28px_-16px_rgba(16,185,129,0.65)] animate-cart-feedback"
          : "bg-violet-600 hover:bg-violet-700"
      } ${disabled || pending ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {showAdded ? (
        <span className="inline-flex items-center gap-1 text-xs">
          <span className="text-base leading-none">✔</span>
          Produto adicionado
        </span>
      ) : (
        children ?? "adicionar ao carrinho"
      )}
    </button>
  );
}
