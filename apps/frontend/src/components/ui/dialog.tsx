'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n';
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  focusContentOnOpen = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  focusContentOnOpen?: boolean;
}) {
  const { t } = useLanguage();
  const content = useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-backdrop" />
        <DialogPrimitive.Content
          ref={content}
          className={`dialog-content ${className ?? ''}`}
          onOpenAutoFocus={(event) => {
            if (focusContentOnOpen) {
              event.preventDefault();
              content.current?.focus({ preventScroll: true });
            }
          }}
        >
          <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="muted">{description}</DialogPrimitive.Description>
          {children}
          <DialogPrimitive.Close
            className="dialog-close button button-ghost button-icon"
            aria-label={t('Đóng hộp thoại', 'Close dialog')}
          >
            <X size={19} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
