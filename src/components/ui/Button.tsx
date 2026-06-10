'use client';
import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  size?: 'sm' | 'md';
  depth?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  danger:    'btn-danger',
  ghost:     'btn-ghost',
  success:   'btn-success',
};

const Spinner = ({ size = 12 }: { size?: number }) => (
  <span
    className="spinner"
    style={{ width: size, height: size, borderWidth: 2, flexShrink: 0 }}
    aria-hidden="true"
  />
);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading = false, size, depth = false, disabled, children, className = '', style, ...rest }, ref) => {
    const cls = [
      'btn',
      VARIANT_CLASS[variant],
      size === 'sm' ? 'btn-sm' : '',
      depth ? 'btn-depth' : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={cls}
        disabled={disabled || loading}
        aria-busy={loading}
        style={{
          cursor: loading ? 'wait' : undefined,
          ...style,
        }}
        {...rest}
      >
        {loading && <Spinner size={size === 'sm' ? 10 : 12} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
