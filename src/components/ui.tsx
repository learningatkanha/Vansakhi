import type { ComponentProps, ReactNode } from "react";

/** A few shared building blocks so every screen looks the same. */

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-line bg-paper p-6 ${className}`} {...props} />;
}

export function Button({ className = "", variant = "primary", ...props }: ComponentProps<"button"> & { variant?: "primary" | "quiet" }) {
  const look =
    variant === "primary"
      ? "bg-forest-600 text-white hover:bg-forest-700 disabled:bg-forest-600/40"
      : "border border-line bg-paper text-ink hover:bg-wash disabled:text-muted";
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${look} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm outline-none placeholder:text-muted focus:border-forest-600 focus:ring-2 focus:ring-forest-100 ${className}`}
      {...props}
    />
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
      {children}
    </label>
  );
}

export function ComingSoon({ phase, children }: { phase: number; children: ReactNode }) {
  return (
    <Card className="py-16 text-center">
      <p className="text-muted">{children}</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-forest-600">Arrives in phase {phase}</p>
    </Card>
  );
}
