"use client";

import { useActionState } from "react";
import { mfaAction, type MfaState } from "@/app/actions/auth";

export function MfaForm({ next, enrolled }: { next: string; enrolled: boolean }) {
  const [state, action, pending] = useActionState<MfaState, FormData>(mfaAction, {});
  if (!enrolled && !state.enrolSecret) {
    return (
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <p className="mb-3">You have not set up an authenticator app yet.</p>
        <button className="btn btn-primary" disabled={pending}>Set up authenticator</button>
      </form>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      {state.enrolSecret && (
        <div className="card p-3 bg-surface-2 text-sm space-y-1">
          <p>Add this key to your authenticator app (Google Authenticator, Aegis, 1Password…), then enter the 6-digit code it shows.</p>
          <p className="font-mono break-all text-base">{state.enrolSecret}</p>
          <details><summary>otpauth URI</summary><code className="break-all">{state.otpauth}</code></details>
          <input type="hidden" name="secret" value={state.enrolSecret} />
        </div>
      )}
      <div className="field">
        <label htmlFor="code">Authenticator code</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="font-mono max-w-[10rem]" />
      </div>
      {state.error && <p role="alert" className="text-bad">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>Verify</button>
    </form>
  );
}
