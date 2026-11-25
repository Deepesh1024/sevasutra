import Link from "next/link";

const NAV: [string, string][] = [
  ["/admin", "Overview"],
  ["/admin/schemes", "Schemes"],
  ["/admin/import", "Import / extract"],
  ["/admin/sources", "Sources"],
  ["/admin/feedback", "Feedback"],
  ["/admin/translations", "Translations"],
  ["/admin/notifications", "Notifications"],
  ["/admin/audit", "Audit log"],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <nav aria-label="Admin" className="card p-2">
        <ul className="flex flex-wrap gap-1">{NAV.map(([h, l]) => <li key={h}><Link href={h} className="btn btn-sm">{l}</Link></li>)}</ul>
      </nav>
      {children}
    </div>
  );
}
