export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mx-auto mt-8 max-w-sm">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-5 text-xl font-bold text-slate-900">{title}</h1>
        {children}
      </div>
      {footer && <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>}
    </div>
  );
}
