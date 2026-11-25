"use client";

import { recordRedirectAction } from "@/app/actions/applications";

export function OpenPortalButton({ appId, url, label }: { appId: string; url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-primary"
      onClick={() => {
        void recordRedirectAction(appId);
      }}
    >
      {label}<span aria-hidden> ↗</span><span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
