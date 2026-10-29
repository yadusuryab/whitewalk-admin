/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Search,
  X,
} from "lucide-react";

/* ---------- classes ---------- */

export const inputCls =
  "h-12 w-full rounded-2xl bg-neutral-100 px-4 text-sm font-medium outline-none transition-all duration-200 placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-950";
export const textareaCls = inputCls.replace("h-12", "min-h-[5rem] py-3");
export const labelCls = "mb-2 block text-sm font-semibold text-neutral-500";
export const selectCls =
  "h-9 cursor-pointer rounded-full bg-neutral-100 px-3 text-xs font-semibold outline-none transition-all focus:ring-2 focus:ring-neutral-950";
export const checkCls = "h-4 w-4 cursor-pointer rounded accent-neutral-950";

export const PER_PAGE: [number, string][] = [5, 10, 20, 50].map((n) => [
  n,
  `${n} per page`,
]);

/* ---------- atoms ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft" | "danger";
  icon?: boolean;
  loading?: boolean;
};

const VARIANT = {
  primary: "bg-neutral-950 text-white hover:bg-blue-600",
  soft: "bg-neutral-100 text-neutral-950 hover:bg-neutral-200",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
};

export function Btn({
  variant = "soft",
  icon,
  loading,
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: BtnProps) {
  return (
    <button
      type={type}
      aria-label={icon ? rest.title : undefined}
      disabled={disabled || loading}
      {...rest}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full text-sm font-extrabold tracking-tight transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${
        icon ? "w-10" : "px-5"
      } ${VARIANT[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Chip({
  active,
  danger,
  onClick,
  children,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const tone = danger
    ? active
      ? "bg-red-50 text-red-500 line-through"
      : "bg-neutral-100 hover:bg-neutral-200"
    : active
      ? "bg-neutral-950 text-white"
      : "bg-neutral-100 hover:bg-neutral-200";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold tracking-tight transition-all duration-150 active:scale-90 ${tone}`}
    >
      {!danger && active && <Check className="h-3 w-3" strokeWidth={3} />}
      {children}
    </button>
  );
}

export function Tag({
  children,
  className = "bg-neutral-100 text-neutral-600",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${className}`}
    >
      {children}
    </span>
  );
}

export const BLUE_TAG = "bg-blue-600/10 text-blue-700";

export function Pill({
  on,
  onLabel,
  offLabel,
  onClick,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-extrabold tracking-tight transition-all active:scale-95 ${
        on
          ? "bg-blue-600/10 text-blue-700 hover:bg-blue-600/20"
          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
      }`}
    >
      {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {on ? onLabel : offLabel}
    </button>
  );
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) =>
        onChange(
          (typeof value === "number"
            ? Number(e.target.value)
            : e.target.value) as T,
        )
      }
      className={selectCls}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function Thumb({
  src,
  className = "h-14 w-14",
}: {
  src?: string | null;
  className?: string;
}) {
  const [bad, setBad] = useState(false);
  return src && !bad ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBad(true)}
      className={`${className} shrink-0 rounded-2xl bg-white object-cover`}
    />
  ) : (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-white`}
    >
      <ImageIcon className="h-5 w-5 text-neutral-300" />
    </div>
  );
}

/** One list row. Same markup on mobile and desktop. */
export function Row({
  children,
  onClick,
  active,
  dim,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex flex-wrap items-center gap-3 rounded-3xl p-3 transition-colors sm:flex-nowrap ${
        onClick ? "cursor-pointer" : ""
      } ${active ? "bg-blue-600/10" : "bg-neutral-100 hover:bg-neutral-200/70"} ${
        dim ? "opacity-60" : ""
      }`}
    >
      {children}
    </div>
  );
}

/** Stops a row click when the user hits an action inside it. */
export const Actions = ({ children }: { children: ReactNode }) => (
  <div
    className="ml-auto flex flex-wrap items-center gap-2"
    onClick={(e) => e.stopPropagation()}
  >
    {children}
  </div>
);

/* ---------- modal (Esc closes, body scroll locked) ---------- */

export function Modal({
  onClose,
  children,
  wide,
}: {
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    const prev = document.body.style.overflow;
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/50 backdrop-blur-md duration-200 animate-in fade-in sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white text-neutral-950 shadow-2xl duration-200 animate-in slide-in-from-bottom-4 sm:rounded-[1.75rem] ${
          wide ? "sm:max-w-lg" : "sm:max-w-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export const ModalHead = ({
  title,
  onClose,
}: {
  title: ReactNode;
  onClose: () => void;
}) => (
  <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-white/90 p-5 pb-3 backdrop-blur md:p-6 md:pb-3">
    <h3 className="text-4xl font-extrabold leading-[0.92] tracking-[-0.045em]">
      {title}
    </h3>
    <Btn icon title="Close" onClick={onClose}>
      <X className="h-4 w-4" />
    </Btn>
  </div>
);

export const ModalBody = ({ children }: { children: ReactNode }) => (
  <div className="space-y-5 px-5 pb-5 md:px-6">{children}</div>
);

export const ModalFoot = ({ children }: { children: ReactNode }) => (
  <div className="sticky bottom-0 flex justify-end gap-2 border-t border-neutral-200 bg-white/90 p-4 backdrop-blur md:px-6">
    {children}
  </div>
);

/* ---------- page parts ---------- */

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // "/" focuses search, like most native apps.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} pl-11`}
      />
    </div>
  );
}

export function PageHead({
  count,
  title,
  children,
}: {
  count?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="duration-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="inline-flex items-center gap-2 rounded-md bg-blue-600/10 px-3.5 py-1.5 text-sm font-semibold text-blue-700">
        <span className="h-2 w-2 rounded-full bg-blue-600" />
        {count ?? "…"}
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <h1 className="text-balance text-5xl font-extrabold leading-[0.9] tracking-[-0.045em] md:text-7xl">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);
  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-3 md:flex-row">
      <p className="text-sm font-semibold text-neutral-500">
        Page {page} of {pages}
      </p>
      <div className="flex items-center gap-1.5">
        <Btn
          icon
          title="Previous page"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Btn>
        {nums.map((n) => (
          <Btn
            key={n}
            icon
            variant={n === page ? "primary" : "soft"}
            onClick={() => onPage(n)}
          >
            {n}
          </Btn>
        ))}
        <Btn
          icon
          title="Next page"
          disabled={page === pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Btn>
      </div>
    </div>
  );
}

export const Skeleton = ({ rows = 6 }: { rows?: number }) => (
  <div className="space-y-2" aria-busy="true">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="h-[76px] animate-pulse rounded-3xl bg-neutral-100" />
    ))}
  </div>
);

export const Empty = ({
  text,
  action = "Clear filters",
  onAction,
}: {
  text: string;
  action?: string;
  onAction?: () => void;
}) => (
  <div className="py-16 text-center duration-300 animate-in fade-in">
    <p className="text-3xl font-extrabold tracking-[-0.04em]">{text}</p>
    {onAction && (
      <Btn className="mt-4" onClick={onAction}>
        {action}
      </Btn>
    )}
  </div>
);