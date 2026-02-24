import Link from "next/link";
import { Track1InitialForm } from "@/components/track1/track1-initial-form";

export default function Track1Page() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-teal dark:text-teal-300">
              개인 성과(업적) 평가 Wizard
            </p>
            <h1 className="mt-1 text-2xl font-black text-brand-ink dark:text-slate-100 md:text-3xl">
              Track 1. 기본 정보 입력
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            대시보드로
          </Link>
        </div>

        <Track1InitialForm />
      </section>
    </main>
  );
}
