
'use client';
import { ButtonHTMLAttributes } from 'react';

export function SubmitButton({
  pending,
  children,
  ...props
}: { pending?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending ? 'true' : 'false'}
      {...props}
      className={`inline-flex items-center gap-2 ${props.className ?? ''}`}
    >
      {pending ? <span className="animate-spin h-4 w-4 border rounded-full border-current border-t-transparent" /> : null}
      <span>{pending ? 'Submitting…' : children}</span>
    </button>
  );
}
