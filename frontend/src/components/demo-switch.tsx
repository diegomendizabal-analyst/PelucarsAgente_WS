"use client";
import { useState, useTransition } from "react";
import { setDemoVisible } from "@/app/(crm)/demo/actions";

export function DemoSwitch({ visible }: { visible: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <div className="demo-switch-control"><button type="button" role="switch" aria-checked={visible} aria-label="Mostrar datos demo" disabled={pending} className="demo-switch-button" onClick={() => startTransition(async () => {
    setError("");
    try {
      const result = await setDemoVisible(!visible);
      if (result.error) setError(result.error);
      else window.location.reload();
    }
    catch { setError("No pudimos cambiar la vista demo."); }
  })}><span>{pending ? "Cambiando…" : "Datos demo"}</span><span className={`ios-switch ${visible ? "on" : ""}`} aria-hidden="true"><span /></span></button>{error && <span role="alert" className="field-error">{error}</span>}</div>;
}
