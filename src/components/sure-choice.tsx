"use client";

/**
 * "I'm sure" / "Not sure, ask a researcher", shown once a species is chosen.
 * Sure -> Self-confirmed (Verified straight away for researchers and admins); not sure -> Named.
 * With `name`, also sends "1"/"0" in a plain form.
 */
export function SureChoice({
  value,
  onChange,
  reviewer = false,
  name,
}: {
  value: boolean | null;
  onChange: (sure: boolean) => void;
  reviewer?: boolean;
  name?: string;
}) {
  const option = (sure: boolean, title: string, hint: string) => {
    const on = value === sure;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => onChange(sure)}
        className={`flex-1 rounded-lg border p-2.5 text-left text-sm ${on ? "border-forest-600 bg-forest-50" : "border-line bg-paper hover:bg-wash"}`}
      >
        <span className={`font-medium ${on ? "text-forest-800" : ""}`}>
          {on ? "● " : "○ "}
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </button>
    );
  };
  return (
    <div>
      {name && <input type="hidden" name={name} value={value === null ? "" : value ? "1" : "0"} />}
      <p className="mb-1.5 text-sm font-medium">How sure are you of this name?</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {option(true, "I'm sure", reviewer ? "It will show as Verified." : "Common species. It will show as Self-confirmed.")}
        {option(false, "Not sure, ask a researcher", "It will show as Named until a researcher checks it.")}
      </div>
    </div>
  );
}
