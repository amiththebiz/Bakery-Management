import { type ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: string;
  sublabel?: string;
};

export function StatCard({ label, value, icon, accent = 'text-stone-700', sublabel }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
          {sublabel && <p className="mt-1 text-xs text-stone-400">{sublabel}</p>}
        </div>
        <div className="rounded-lg bg-stone-100 p-2.5 text-stone-600">{icon}</div>
      </div>
    </Card>
  );
}

type BadgeProps = {
  children: ReactNode;
  color: 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'orange';
};

const badgeColors: Record<string, string> = {
  gray: 'bg-stone-100 text-stone-700 border-stone-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
};

export function Badge({ children, color }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeColors[color]}`}>
      {children}
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
};

const buttonVariants: Record<string, string> = {
  primary: 'bg-amber-600 text-white hover:bg-amber-700 border-amber-600',
  secondary: 'bg-white text-stone-700 hover:bg-stone-50 border-stone-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
  ghost: 'bg-transparent text-stone-600 hover:bg-stone-100 border-transparent',
};

const buttonSizes: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, type = 'button', className = '' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
};

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <Card className={`relative z-10 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-stone-800">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </div>
  );
}

type InputProps = {
  label?: string;
  type?: string;
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  step?: string;
  min?: string;
};

export function Input({ label, type = 'text', value, onChange, placeholder, step, min }: InputProps) {
  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-stone-600">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        min={min}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
      />
    </div>
  );
}

type SelectProps = {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
};

export function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-stone-600">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-amber-600" />
    </div>
  );
}
