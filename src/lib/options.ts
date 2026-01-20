export type Option = { value: string; label: string; disabled?: boolean };

export function normalizeOptions(input: Array<Partial<Option> | string>): Option[] {
  return input
    .map((o, i): Option | null => {
      if (typeof o === 'string') {
        const value = o.trim();
        if (!value) return null;
        return { value, label: value, disabled: false };
      }

      const raw = String(o?.value ?? "").trim();
      if (!raw) return null;
      const value = raw; // keep original, but guaranteed non-empty here
      const label = String((o?.label ?? raw) || `Option ${i + 1}`).trim() || value;
      return { value, label, disabled: !!o?.disabled };
    })
    .filter((x): x is Option => x !== null);
}
