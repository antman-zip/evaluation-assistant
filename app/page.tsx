import { TrackSelectorCard } from "@/components/wizard/track-selector-card";

export default function HomePage() {
  return (
    <main className="noise-overlay min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-amber-100 bg-white/75 p-8 backdrop-blur md:p-10 dark:border-slate-700 dark:bg-slate-900/75">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal dark:text-teal-300">
            2026 Evaluation Assistant
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-ink dark:text-slate-100 md:text-4xl">
            상시 기록 + 시즌 평가 작성 도우미
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">
            프로젝트/태스크 종료 시점에 상시로 기록해두고, 시즌에 AI로 한번에 정리해 업적평가와
            역량평가 초안을 빠르게 완성할 수 있습니다.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <TrackSelectorCard
            title="상시 기록 정리"
            description="이벤트/프로젝트/태스크 종료 시점마다 메모를 쌓고, 시즌에 AI 정리 초안으로 변환합니다."
            href="/work-log"
            accent="indigo"
            bullets={[
              "업무 종료 직후 핵심 내용 빠르게 저장",
              "시즌 필터로 기록 묶음 조회",
              "업적/역량 평가용 문장 초안 자동 생성"
            ]}
          />
          <TrackSelectorCard
            title="Track 1. 개인 성과(업적) 평가"
            description="연간 목표 달성 결과를 정량/정성으로 입력하고, AI가 ERP 제출용 문장으로 가공합니다."
            href="/track-1"
            accent="teal"
            bullets={[
              "과업명, 달성 실적, 등급, 점수 입력",
              "개조식 메모를 논리적인 성과 문장으로 정리",
              "최대 2000자 작성자 종합 의견 초안 생성"
            ]}
          />
          <TrackSelectorCard
            title="Track 2. 역량 평가"
            description="공통/본부/직무 역량별 행동 사례를 작성하고, 성과 데이터 기반으로 문장을 보강합니다."
            href="/track-2"
            accent="coral"
            bullets={[
              "역량별 구체적 사례, 등급, 점수 입력",
              "성과 내용에서 역량 키워드 매핑 문장 추출",
              "ERP 복사용 구조화 결과 제공"
            ]}
          />
        </div>
      </section>
    </main>
  );
}
