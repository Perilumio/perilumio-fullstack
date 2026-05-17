'use client';
import { useId, useState } from 'react';

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  ariaLabel?: string;
  ariaDescribedBy?: string;
};

export default function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  required,
  minLength,
  ariaLabel,
  ariaDescribedBy,
}: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const toggleLabel = visible ? 'Passwort verbergen' : 'Passwort anzeigen';

  return (
    <div className="password-field">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder}
        aria-describedby={ariaDescribedBy}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={toggleLabel}
        aria-pressed={visible}
        title={toggleLabel}
        tabIndex={0}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.6 18.6 0 0 1 4.06-5.06" />
      <path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a18.7 18.7 0 0 1-3.17 4.19" />
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
