import type { WorkLogEntry, WorkLogFolder, WorkLogState } from "@/types/work-log";

// ---------------------------------------------------------------------------
// Sample ID prefixes – used to identify sample data for selective deletion
// ---------------------------------------------------------------------------
const SAMPLE_FOLDER_PREFIX = "folder-sample-";
const SAMPLE_ENTRY_PREFIX = "work-sample-";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sampleFolderId(suffix: string) {
  return `${SAMPLE_FOLDER_PREFIX}${suffix}`;
}

function sampleEntryId(suffix: string) {
  return `${SAMPLE_ENTRY_PREFIX}${suffix}`;
}

function iso(dateStr: string) {
  return new Date(`${dateStr}T09:00:00Z`).toISOString();
}

// ---------------------------------------------------------------------------
// Sample Folders (3 root folders)
// ---------------------------------------------------------------------------
const SAMPLE_FOLDERS: WorkLogFolder[] = [
  {
    id: sampleFolderId("system"),
    name: "[샘플] 시스템 개선",
    parentId: null,
    createdAt: iso("2025-07-01"),
    updatedAt: iso("2025-12-20"),
  },
  {
    id: sampleFolderId("customer"),
    name: "[샘플] 고객 대응",
    parentId: null,
    createdAt: iso("2025-07-01"),
    updatedAt: iso("2025-12-18"),
  },
  {
    id: sampleFolderId("team"),
    name: "[샘플] 팀 역량 강화",
    parentId: null,
    createdAt: iso("2025-07-01"),
    updatedAt: iso("2025-12-22"),
  },
];

// ---------------------------------------------------------------------------
// Sample Entries (18 entries, 6 per folder, July–December 2025)
// ---------------------------------------------------------------------------
const SAMPLE_ENTRIES: WorkLogEntry[] = [
  // ── Folder 1: 시스템 개선 ──────────────────────────────────────────────
  {
    id: sampleEntryId("sys-01"),
    folderId: sampleFolderId("system"),
    sortOrder: 1,
    title: "레거시 API v2 마이그레이션",
    type: "프로젝트",
    date: "2025-07-25",
    durationWeeks: 4,
    durationDays: 0,
    context:
      "기존 v1 API의 성능 한계와 유지보수 비용 증가로 v2 전환이 시급했음. 주요 B2B 클라이언트 3곳과 일정 조율 후 단계적 마이그레이션 진행.",
    result:
      "v2 API 전환 완료. 응답 속도 40% 개선, 에러율 0.3%→0.05% 감소. 하위 호환 레이어 유지하여 클라이언트 무중단 전환 달성.",
    metrics: "API 응답 속도 40% 개선, 에러율 83% 감소 (0.3%→0.05%)",
    tags: "API, 마이그레이션, 백엔드",
    createdAt: iso("2025-07-01"),
    updatedAt: iso("2025-07-25"),
  },
  {
    id: sampleEntryId("sys-02"),
    folderId: sampleFolderId("system"),
    sortOrder: 2,
    title: "CI/CD 파이프라인 최적화",
    type: "태스크",
    date: "2025-08-15",
    durationWeeks: 1,
    durationDays: 0,
    context:
      "배포 파이프라인 평균 소요시간 25분으로, 팀 생산성 저하 원인이 됨. 캐시 전략 및 병렬 빌드 도입 검토.",
    result:
      "빌드 시간 25분→8분으로 단축. Docker 레이어 캐시 + 테스트 병렬화 적용. 일간 배포 횟수 2회→5회로 증가.",
    metrics: "빌드 시간 68% 단축 (25분→8분), 일간 배포 횟수 150% 증가",
    tags: "CI/CD, DevOps, 자동화",
    createdAt: iso("2025-08-11"),
    updatedAt: iso("2025-08-15"),
  },
  {
    id: sampleEntryId("sys-03"),
    folderId: sampleFolderId("system"),
    sortOrder: 3,
    title: "모니터링 대시보드 구축",
    type: "태스크",
    date: "2025-09-19",
    durationWeeks: 2,
    durationDays: 0,
    context:
      "장애 감지가 고객 제보에 의존하던 상황. Grafana + Prometheus 기반 실시간 모니터링 체계 필요.",
    result:
      "주요 서비스 15개에 대한 실시간 대시보드 구축. 알림 규칙 30개 설정. 장애 감지 시간 평균 15분→2분 이내로 단축.",
    metrics: "장애 감지 시간 87% 단축 (15분→2분), 모니터링 커버리지 100%",
    tags: "모니터링, Grafana, 운영",
    createdAt: iso("2025-09-08"),
    updatedAt: iso("2025-09-19"),
  },
  {
    id: sampleEntryId("sys-04"),
    folderId: sampleFolderId("system"),
    sortOrder: 4,
    title: "마이크로서비스 분리 1차",
    type: "프로젝트",
    date: "2025-10-24",
    durationWeeks: 3,
    durationDays: 0,
    context:
      "모놀리식 아키텍처에서 주문/결제 도메인 분리 필요. 트래픽 증가에 따른 독립 스케일링 요구.",
    result:
      "주문 서비스, 결제 서비스 2개 마이크로서비스 분리 완료. 개별 배포 가능해지면서 배포 충돌 제로화. 주문 처리량 2배 확장 검증 완료.",
    metrics: "배포 충돌 제로화, 주문 처리 확장성 200% 확보",
    tags: "MSA, 아키텍처, 주문, 결제",
    createdAt: iso("2025-10-06"),
    updatedAt: iso("2025-10-24"),
  },
  {
    id: sampleEntryId("sys-05"),
    folderId: sampleFolderId("system"),
    sortOrder: 5,
    title: "DB 쿼리 성능 튜닝",
    type: "태스크",
    date: "2025-11-14",
    durationWeeks: 1,
    durationDays: 0,
    context:
      "슬로우 쿼리 Top 20이 전체 DB 부하의 60%를 차지. 인덱스 최적화 및 쿼리 리팩토링 진행.",
    result:
      "슬로우 쿼리 20건 중 18건 해결. 평균 쿼리 응답 시간 320ms→85ms. DB CPU 사용률 75%→40%로 안정화.",
    metrics: "쿼리 응답 시간 73% 개선 (320ms→85ms), DB CPU 46% 감소",
    tags: "DB, 성능, 쿼리 최적화",
    createdAt: iso("2025-11-10"),
    updatedAt: iso("2025-11-14"),
  },
  {
    id: sampleEntryId("sys-06"),
    folderId: sampleFolderId("system"),
    sortOrder: 6,
    title: "연말 장애 대응 체계 점검",
    type: "태스크",
    date: "2025-12-18",
    durationWeeks: 0,
    durationDays: 3,
    context:
      "연말 트래픽 피크 대비 장애 대응 매뉴얼 갱신 및 모의 장애 훈련 실시.",
    result:
      "장애 대응 매뉴얼 v3 갱신. 팀 전원 대상 모의 훈련 2회 실시. 장애 대응 시간 목표(5분 이내 1차 대응) 달성률 100%.",
    metrics: "장애 대응 훈련 2회 실시, 1차 대응 목표 달성률 100%",
    tags: "장애 대응, 운영, 연말",
    createdAt: iso("2025-12-16"),
    updatedAt: iso("2025-12-18"),
  },

  // ── Folder 2: 고객 대응 ──────────────────────────────────────────────
  {
    id: sampleEntryId("cust-01"),
    folderId: sampleFolderId("customer"),
    sortOrder: 1,
    title: "B2B 고객 온보딩 프로세스 개선",
    type: "프로젝트",
    date: "2025-07-18",
    durationWeeks: 3,
    durationDays: 0,
    context:
      "신규 B2B 고객 온보딩 평균 4주 소요. 고객 이탈률 15% 중 절반이 온보딩 단계에서 발생.",
    result:
      "온보딩 체크리스트 표준화, 자동화 워크플로우 구축. 온보딩 기간 4주→2주로 단축. 온보딩 단계 이탈률 7.5%→2%로 감소.",
    metrics: "온보딩 기간 50% 단축, 이탈률 73% 감소 (7.5%→2%)",
    tags: "B2B, 온보딩, 고객 경험",
    createdAt: iso("2025-07-01"),
    updatedAt: iso("2025-07-18"),
  },
  {
    id: sampleEntryId("cust-02"),
    folderId: sampleFolderId("customer"),
    sortOrder: 2,
    title: "분기별 고객 만족도 조사 실시",
    type: "이벤트",
    date: "2025-08-22",
    durationWeeks: 0,
    durationDays: 3,
    context:
      "Q3 고객 만족도 정기 조사. NPS 및 CSAT 측정을 통한 서비스 개선점 도출.",
    result:
      "응답률 68% 달성 (전분기 대비 +12%p). NPS 42→48로 상승. 주요 개선 요구사항 5건 도출 및 로드맵 반영.",
    metrics: "NPS 42→48 (+6), 응답률 68% (전분기 56%)",
    tags: "고객 만족도, NPS, 조사",
    createdAt: iso("2025-08-20"),
    updatedAt: iso("2025-08-22"),
  },
  {
    id: sampleEntryId("cust-03"),
    folderId: sampleFolderId("customer"),
    sortOrder: 3,
    title: "고객 VOC 분석 및 개선안 도출",
    type: "태스크",
    date: "2025-09-12",
    durationWeeks: 1,
    durationDays: 0,
    context:
      "최근 3개월 CS 인입 건 분석. 반복 문의 패턴 파악 및 셀프서비스 전환 가능 항목 식별.",
    result:
      "반복 문의 Top 10 패턴 정리. FAQ 및 가이드 문서 15건 신규 작성. CS 인입량 월 320건→240건으로 25% 감소.",
    metrics: "CS 인입량 25% 감소 (320→240건/월), FAQ 15건 추가",
    tags: "VOC, CS, 고객 분석",
    createdAt: iso("2025-09-08"),
    updatedAt: iso("2025-09-12"),
  },
  {
    id: sampleEntryId("cust-04"),
    folderId: sampleFolderId("customer"),
    sortOrder: 4,
    title: "셀프서비스 포털 MVP 개발",
    type: "프로젝트",
    date: "2025-10-31",
    durationWeeks: 4,
    durationDays: 0,
    context:
      "고객사가 직접 설정 변경, 사용량 확인, 청구서 조회를 할 수 있는 셀프서비스 포털 MVP 개발.",
    result:
      "셀프서비스 포털 v1 출시. 계정 설정, 사용량 대시보드, 청구서 다운로드 기능 제공. 출시 2주 만에 활성 사용 고객 40% 달성.",
    metrics: "포털 활성 사용률 40%, CS 문의 추가 15% 감소",
    tags: "셀프서비스, 포털, MVP",
    createdAt: iso("2025-10-06"),
    updatedAt: iso("2025-10-31"),
  },
  {
    id: sampleEntryId("cust-05"),
    folderId: sampleFolderId("customer"),
    sortOrder: 5,
    title: "주요 고객사 연말 간담회",
    type: "이벤트",
    date: "2025-11-21",
    durationWeeks: 0,
    durationDays: 1,
    context:
      "Top 10 고객사 대상 연말 간담회 개최. 내년 로드맵 공유 및 파트너십 강화 목적.",
    result:
      "10개 고객사 중 8개사 참석. 내년 로드맵 사전 공유로 긍정적 피드백. 2개사 추가 계약 논의 시작. 고객 관계 강화 확인.",
    metrics: "참석률 80%, 추가 계약 논의 2건 확보",
    tags: "간담회, 고객 관계, 파트너십",
    createdAt: iso("2025-11-20"),
    updatedAt: iso("2025-11-21"),
  },
  {
    id: sampleEntryId("cust-06"),
    folderId: sampleFolderId("customer"),
    sortOrder: 6,
    title: "고객 이탈 방지 프로세스 수립",
    type: "태스크",
    date: "2025-12-19",
    durationWeeks: 2,
    durationDays: 0,
    context:
      "월간 이탈률 3%로 업계 평균(2%) 대비 높음. 이탈 조기 경보 시스템 및 리텐션 프로세스 수립 필요.",
    result:
      "이탈 예측 모델(사용량 감소, 문의 빈도 변화 기반) 구축. 리텐션 워크플로우 3단계 정의. 12월 이탈률 3%→2.1%로 개선.",
    metrics: "이탈률 30% 감소 (3%→2.1%), 리텐션 프로세스 3단계 수립",
    tags: "리텐션, 이탈 방지, 고객 분석",
    createdAt: iso("2025-12-09"),
    updatedAt: iso("2025-12-19"),
  },

  // ── Folder 3: 팀 역량 강화 ─────────────────────────────────────────────
  {
    id: sampleEntryId("team-01"),
    folderId: sampleFolderId("team"),
    sortOrder: 1,
    title: "사내 기술 세미나 발표",
    type: "이벤트",
    date: "2025-07-11",
    durationWeeks: 0,
    durationDays: 1,
    context:
      "전사 기술 세미나에서 '이벤트 드리븐 아키텍처 실전 적용기' 주제로 발표. 팀 내 지식 공유 문화 활성화 목적.",
    result:
      "사내 참석자 45명. 발표 만족도 4.6/5. 타 팀 3곳에서 아키텍처 컨설팅 요청. 기술 블로그 포스트로 발행.",
    metrics: "참석자 45명, 만족도 4.6/5, 컨설팅 요청 3건",
    tags: "세미나, 발표, 지식 공유",
    createdAt: iso("2025-07-10"),
    updatedAt: iso("2025-07-11"),
  },
  {
    id: sampleEntryId("team-02"),
    folderId: sampleFolderId("team"),
    sortOrder: 2,
    title: "신규 입사자 온보딩 가이드 제작",
    type: "프로젝트",
    date: "2025-08-29",
    durationWeeks: 2,
    durationDays: 0,
    context:
      "하반기 신규 입사자 5명 예정. 기존 온보딩이 구전에 의존하여 일관성 부족. 체계적 가이드 필요.",
    result:
      "온보딩 가이드 v1 완성 (환경 설정, 코드베이스 개요, 업무 프로세스 등 8개 챕터). 신규 입사자 독립 업무 수행까지 평균 3주→2주로 단축.",
    metrics: "온보딩 기간 33% 단축 (3주→2주), 가이드 8개 챕터 작성",
    tags: "온보딩, 가이드, 문서화",
    createdAt: iso("2025-08-18"),
    updatedAt: iso("2025-08-29"),
  },
  {
    id: sampleEntryId("team-03"),
    folderId: sampleFolderId("team"),
    sortOrder: 3,
    title: "코드 리뷰 프로세스 표준화",
    type: "태스크",
    date: "2025-09-05",
    durationWeeks: 1,
    durationDays: 0,
    context:
      "코드 리뷰 기준이 리뷰어마다 달라 품질 편차 발생. 체크리스트 및 가이드라인 표준화 필요.",
    result:
      "코드 리뷰 체크리스트 작성 (보안, 성능, 가독성 등 12개 항목). PR 템플릿 도입. 리뷰 리드타임 평균 2일→0.5일로 개선.",
    metrics: "리뷰 리드타임 75% 단축 (2일→0.5일), 체크리스트 12항목",
    tags: "코드 리뷰, 프로세스, 품질",
    createdAt: iso("2025-09-01"),
    updatedAt: iso("2025-09-05"),
  },
  {
    id: sampleEntryId("team-04"),
    folderId: sampleFolderId("team"),
    sortOrder: 4,
    title: "외부 컨퍼런스 참석 및 사내 공유",
    type: "이벤트",
    date: "2025-10-17",
    durationWeeks: 0,
    durationDays: 2,
    context:
      "FEConf 2025 참석. 최신 프론트엔드 기술 트렌드 파악 및 팀 내 인사이트 공유 목적.",
    result:
      "세션 6개 참석. 사내 공유 세션 개최 (참석자 20명). React Server Components 도입 검토 시작. 팀 기술 로드맵에 2건 반영.",
    metrics: "사내 공유 참석자 20명, 기술 로드맵 반영 2건",
    tags: "컨퍼런스, FEConf, 기술 트렌드",
    createdAt: iso("2025-10-16"),
    updatedAt: iso("2025-10-17"),
  },
  {
    id: sampleEntryId("team-05"),
    folderId: sampleFolderId("team"),
    sortOrder: 5,
    title: "팀 내 기술 스터디 운영",
    type: "프로젝트",
    date: "2025-11-28",
    durationWeeks: 4,
    durationDays: 0,
    context:
      "시스템 디자인 역량 강화를 위한 주 1회 스터디 운영. 'Designing Data-Intensive Applications' 기반.",
    result:
      "4주간 8회 세션 진행 (참여자 6명). 주제별 발표 및 토론. 참여자 전원 설계 역량 자기평가 향상 (3.2→4.1/5). 스터디 자료 사내 위키 공개.",
    metrics: "스터디 8회 완료, 역량 자기평가 28% 향상 (3.2→4.1/5)",
    tags: "스터디, 역량 강화, 시스템 디자인",
    createdAt: iso("2025-11-04"),
    updatedAt: iso("2025-11-28"),
  },
  {
    id: sampleEntryId("team-06"),
    folderId: sampleFolderId("team"),
    sortOrder: 6,
    title: "연간 회고 및 차년도 OKR 초안 작성",
    type: "태스크",
    date: "2025-12-22",
    durationWeeks: 1,
    durationDays: 0,
    context:
      "2025년 팀 성과 회고 및 2026년 OKR 초안 작성. 팀원 전원 참여형 워크숍 형태로 진행.",
    result:
      "연간 회고 워크숍 실시 (참석 8명). 2025 성과 요약 문서 작성. 2026 OKR 초안 3개 Objective, 9개 Key Result 도출. 경영진 리뷰 제출 완료.",
    metrics: "OKR 초안 3O-9KR 도출, 팀 전원 참여 (8명)",
    tags: "회고, OKR, 목표 설정",
    createdAt: iso("2025-12-16"),
    updatedAt: iso("2025-12-22"),
  },
];

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Check whether any sample data exists in the current state */
export function hasSampleData(state: WorkLogState): boolean {
  return (
    state.folders.some((f) => f.id.startsWith(SAMPLE_FOLDER_PREFIX)) ||
    state.entries.some((e) => e.id.startsWith(SAMPLE_ENTRY_PREFIX))
  );
}

/** Merge sample folders & entries into the existing state (idempotent) */
export function loadSampleData(prev: WorkLogState): WorkLogState {
  const existingFolderIds = new Set(prev.folders.map((f) => f.id));
  const existingEntryIds = new Set(prev.entries.map((e) => e.id));

  const newFolders = SAMPLE_FOLDERS.filter((f) => !existingFolderIds.has(f.id));
  const newEntries = SAMPLE_ENTRIES.filter((e) => !existingEntryIds.has(e.id));

  if (newFolders.length === 0 && newEntries.length === 0) return prev;

  return {
    ...prev,
    folders: [...prev.folders, ...newFolders],
    entries: [...prev.entries, ...newEntries],
  };
}

/** Remove only sample folders & entries, leaving user data intact */
export function removeSampleData(prev: WorkLogState): WorkLogState {
  const folders = prev.folders.filter((f) => !f.id.startsWith(SAMPLE_FOLDER_PREFIX));
  const entries = prev.entries.filter((e) => !e.id.startsWith(SAMPLE_ENTRY_PREFIX));

  // If the current selection pointed to a removed item, reset it
  const selectionStillValid =
    prev.selection.id === null ||
    (prev.selection.kind === "folder" && folders.some((f) => f.id === prev.selection.id)) ||
    (prev.selection.kind === "entry" && entries.some((e) => e.id === prev.selection.id));

  const selection = selectionStillValid
    ? prev.selection
    : { kind: "entry" as const, id: entries[0]?.id ?? null };

  // Clean up collapsed folder IDs that no longer exist
  const folderIdSet = new Set(folders.map((f) => f.id));
  const collapsedFolderIds = prev.collapsedFolderIds.filter((id) => folderIdSet.has(id));

  return {
    ...prev,
    folders,
    entries,
    selection,
    collapsedFolderIds,
  };
}
