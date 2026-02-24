import Link from "next/link";
import { WorkLogManager } from "@/components/work-log/work-log-manager";

export default function WorkLogPage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              Main Menu | 상시 기록
            </p>
            <h1 className="mt-1 text-2xl font-black text-brand-ink dark:text-slate-100 md:text-3xl">
              시즌 평가용 업무 로그 정리
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            대시보드로
          </Link>
        </div>

        <WorkLogManager />
      </section>
    </main>
  );
}
