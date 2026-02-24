import Link from "next/link";

export default function Track2Page() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-white p-8 shadow-card dark:border-slate-700 dark:bg-slate-900/85">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">Track 2 | How</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">역량 평가 화면 준비 중</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          다음 단계에서 역량별 행동지표 입력 폼과 AI 자동 문장 생성 플로우를 연결합니다.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          대시보드로 이동
        </Link>
      </section>
    </main>
  );
}
