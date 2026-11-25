"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { googleSignInAction } from "@/app/actions/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/** Google Identity Services button. Grants Explorer access only. */
export function GoogleButton({ clientId, next }: { clientId: string; next: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          const r = await googleSignInAction(credential, next);
          if (r.ok && r.next) router.push(r.next);
          else setError(r.error ?? "Sign-in failed");
        },
      });
      if (ref.current) window.google?.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with" });
    };
    document.head.appendChild(s);
    return () => void s.remove();
  }, [clientId, next, router]);

  return (
    <div>
      <div ref={ref} />
      {error && <p role="alert" className="text-bad mt-2">{error}</p>}
    </div>
  );
}
