import Link from "next/link";

type TrackSelectorCardProps = {
  title: string;
  subtitle?: string;
  description: string;
  href: string;
  bullets: string[];
  accent: "teal" | "coral" | "indigo";
};

const accentStyleMap = {
  teal: {
    badge: "bg-brand-mint text-brand-teal",
    border: "border-teal-200",
    button: "bg-brand-teal hover:bg-teal-700"
  },
  coral: {
    badge: "bg-rose-100 text-rose-700",
    border: "border-rose-200",
    button: "bg-brand-coral hover:bg-rose-500"
  },
  indigo: {
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
    border: "border-indigo-200",
    button: "bg-indigo-600 hover:bg-indigo-500"
  }
};

export function TrackSelectorCard({
  title,
  subtitle,
  description,
  href,
  bullets,
  accent
}: TrackSelectorCardProps) {
  const accentStyle = accentStyleMap[accent];

  return (
    <article
      className={`group rounded-3xl border bg-white/90 p-7 shadow-card transition hover:-translate-y-1 dark:border-slate-700 dark:bg-slate-900/85 ${accentStyle.border}`}
    >
      {subtitle && (
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-wide ${accentStyle.badge}`}
        >
          {subtitle}
        </span>
      )}
      <h2 className="mt-4 text-2xl font-bold text-brand-ink dark:text-slate-100">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      <ul className="mt-5 space-y-2 text-sm text-slate-700 dark:text-slate-200">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-300" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-7 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${accentStyle.button}`}
      >
        시작하기
      </Link>
    </article>
  );
}
