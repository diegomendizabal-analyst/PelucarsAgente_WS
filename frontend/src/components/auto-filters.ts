"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// El borrador permanece visible durante la navegación. Sólo la última edición navega.
export function useAutoFilters<T>(committed: T, href: (value: T) => string, valid: (value: T) => boolean) {
  const router = useRouter();
  const key = JSON.stringify(committed);
  const [draft, setDraft] = useState({ key, value: committed });
  const [pending, startTransition] = useTransition();
  const sequence = useRef(0);
  if (!pending && draft.key !== key && (draft.key === "" || valid(draft.value))) setDraft({ key, value: committed });
  useEffect(() => {
    const counter = sequence;
    const cancel = () => { counter.current++; setDraft(current => ({ ...current, key: "" })); };
    window.addEventListener("popstate", cancel);
    return () => { counter.current++; window.removeEventListener("popstate", cancel); };
  }, []);
  function update(value: T, delay = 300) {
    const version = ++sequence.current;
    setDraft({ key, value });
    if (!valid(value)) return;
    startTransition(async () => {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (sequence.current !== version) return;
      startTransition(() => router.replace(href(value), { scroll: false }));
    });
  }
  return { value: draft.value, pending, update };
}
