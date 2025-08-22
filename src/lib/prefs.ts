import { useEffect, useState } from "react";

const KEY = "horti.stayOnAncestry";

export function useAncestryNavPreference() {
  const [stayOnAncestry, setStay] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw != null) setStay(raw === "1");
    } catch { /* ignore */ }
  }, []);

  const update = (v: boolean) => {
    setStay(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
  };

  return { stayOnAncestry, setStayOnAncestry: update };
}
