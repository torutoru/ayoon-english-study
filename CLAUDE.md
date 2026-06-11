# CLAUDE.md

> 이 저장소의 작업 대화는 **한국어**로 진행한다.

## 프로젝트 개요

6살 한국인 아이를 위한 **영어 회화 교육 웹앱**이다. AI가 "티쳐(teacher)", 사용자가 "학생(student)"이 되어 음성으로 영어 대화를 주고받는다. 학생은 노트북 환경에서 내장 마이크/스피커로 이용한다.

전체 요구사항은 [spec/spec.md](spec/spec.md)에, 화면 디자인 시안은 [spec/test.html](spec/test.html)에 있다. 구현 전 항상 이 두 파일을 우선 참조한다.

## 현재 상태

**M1(1차 마일스톤) 구현 완료.** React + TypeScript + Vite로 scaffold되어 있고, 전체 대화 시나리오가 브라우저에서 동작한다. 구현 범위·마일스톤(M2 Whisper WASM 등)은 [spec/개발스펙.md](spec/개발스펙.md) 참고.

실행 전 `.env.example`을 `.env.local`로 복사하고 `VITE_OPENAI_API_KEY`를 채워야 한다(키 없으면 화면 상단에 경고 배너 표시).

## 명령어

```bash
npm install        # 의존성 설치
npm run dev        # 개발 서버 (Vite, 기본 http://localhost:5173)
npm run build      # 프로덕션 빌드 (tsc + vite build)
npm run preview    # 빌드 결과 로컬 미리보기
npm run lint       # ESLint (flat config, eslint.config.js)
```

> 노트: Web Speech API(특히 SpeechRecognition)와 마이크 접근은 `localhost` 또는 HTTPS에서만 동작한다. `npm run dev`의 localhost는 허용된다.

## 핵심 아키텍처

### 대화 루프 (스펙 1~8단계)

앱의 중심은 다음 순환 루프다. 이 흐름이 전체 상태 머신을 결정한다:

1. **주제 생성** — 앱 진입 시 OpenAI API로 6살 아이용 랜덤 주제 생성
2. **질문 생성** — OpenAI로 티쳐의 영어 질문 스크립트(txt) 생성
3. **TTS 재생** — 브라우저 `SpeechSynthesis` API로 질문 음성 출력
4. **학생 답변** — 마이크로 음성 입력
5. **STT 변환** — `SpeechRecognition` API로 음성 → 영어 텍스트
6. **AI 채점** — 학생 답변 텍스트 + 직전 질문 스크립트를 OpenAI에 함께 전달
7. **분기** — 문법 오류/틀린 답이면 **한국어 교정** 스크립트 생성, 정상이면 **다음 영어 질문** 생성
8. 2~7 반복

설계 시 주의: 7단계의 분기(교정 vs 다음 질문)는 6단계 AI 응답으로 판정한다. 대화 컨텍스트(이전 질문/답변)를 OpenAI 요청에 누적 전달해야 일관된 대화가 유지된다.

### STT 폴백 전략

기본은 브라우저 `SpeechRecognition`이다. **인식률이 떨어질 경우 OpenAI Whisper로 폴백**하되, Whisper는 서버 호출이 아니라 **WASM 빌드로 브라우저 내에서 실행**하는 것을 계획한다. 이 폴백 경로는 STT 모듈 내부에서 추상화하여, 호출부가 어떤 엔진을 쓰는지 몰라도 되게 설계한다.

### 데이터 저장 (IndexedDB)

대화 내용은 브라우저 **IndexedDB**에 저장한다.

- **key**: 날짜 문자열 `yyyy-mm-dd`
- **value**:
  ```ts
  {
    topic: string,                                  // 1단계에서 생성한 주제
    messages: Array<{ sender: string, msg: string }>, // sender: '티쳐' | '학생', msg: 스크립트 txt
    summary: string | null                          // messages 요약, 100자 이내
  }
  ```

**summary 생성 규칙 (중요)**: summary는 대화 당일에는 만들지 않고 `null`로 둔다. 이후 다른 날 학생이 접속하면, **오늘 이전 날짜의 기록을 모두 불러와 `summary`가 `null`인 항목을 찾아 OpenAI로 100자 이내 요약을 생성**해 채운다. 즉 요약은 "지난 날짜 정리" 용도의 지연(lazy) 생성이다. 이 요약 생성은 **히스토리 화면 진입 시점**에 트리거되며, 진행 중에는 로딩 화면을 표시한다 (아래 화면 구조 참고).

### OpenAI API 연동

- **private 서비스 전제**로, 백엔드 없이 **브라우저에서 직접 OpenAI API를 호출**한다 (`dangerouslyAllowBrowser` 류 설정 필요).
- 모델: **`gpt-4.1-mini`** 고정.
- OpenAI를 사용하는 지점은 4곳: 주제 생성(1), 질문 생성(2), 답변 채점/다음 질문(6~7), 지난 대화 요약. 이들을 단일 OpenAI 클라이언트/서비스 모듈로 묶어 관리한다.

## 화면 구조

[spec/test.html](spec/test.html)이 디자인·레이아웃의 기준이다 (360×640 모바일 형태 컨테이너, 'Jua' 폰트, 6살 아이 친화적 파스텔 톤). 화면은 3개:

- **메인** (`main-screen`) — "대화하기" / "지난 이야기" 진입
- **대화** (`chat-screen`) — 말풍선 채팅(ai/user) + 가운데 워키토키형 마이크 버튼. 대화 루프가 실행되는 화면
- **히스토리** (`history-screen`) — 날짜·주제 테이블(페이지네이션) + 선택 시 하단에 해당 날짜 대화 표시. IndexedDB 데이터를 읽어 렌더링
  - **진입 시 로딩 화면 (필수)**: 히스토리 화면에 들어오면, 먼저 오늘 이전 날짜 기록 중 `summary`가 `null`인 항목들을 OpenAI로 요약하는 작업을 수행한다. 이 요약 작업이 끝날 때까지 **로딩 화면을 표시**하고, 모두 완료되면 로딩 화면을 닫고 히스토리 목록을 렌더링한다. **요약할 항목이 하나도 없으면(모든 기록에 summary가 있으면) 로딩 화면은 즉시 사라진다.**

test.html의 화면 전환은 `.screen.active` 클래스 토글 방식이지만, React 구현 시에는 라우팅 또는 상태 기반 화면 전환으로 대체한다. 시안의 클래스명/색상/문구는 최대한 유지한다.
