# CLAUDE.md

이 저장소는 한국인 물리치료사가 일본인 환자와 쓰는 실시간 통역 웹앱 **"치료 통역"** 입니다.
**작업 전에 반드시 [`HANDOFF.md`](./HANDOFF.md) 를 끝까지 읽으세요.** (목적, 파일 지도, 튜닝된 값, 버전 기록, 사용자 취향이 모두 있음)

## 명령어

```bash
npm install
npm run dev            # http://127.0.0.1:41723
npm test               # 단위 테스트 (tests/*.test.ts)
npx tsc --noEmit -p .  # 타입 검사
npm run build          # dist/ 빌드
```

## 규칙

- 사용자(김형민/Matt)에게는 쉬운 한국어로 짧게 설명. 코드 식별자는 영어.
- 변경 후 `npm test` 와 `npx tsc --noEmit -p .` 통과 필수.
- 요청 없이 기존 동작을 바꾸지 말 것: 문장 끝 감지 정규식, `PAUSE_AFTER_ENDING` 700ms, `PAUSE_CLEAR_END` 500ms(확실한 끝, v3.6), `PAUSE_WITHOUT_ENDING` 3000ms, 안드로이드 중복 처리(`collapseRepeats`/`appendChunk`), iOS 재시작·소리 잠금 해제.
- **API 키 절대 커밋 금지.** Gemini 키는 각 폰 localStorage `chiryo.geminiKey` 에만.
- 출시: `index.html` 의 `app-version` 과 `package.json` version 을 같이 올림 → 커밋 → `git push origin main` → `git tag vX.Y` 푸시 → Pages 워크플로 성공 확인 → 실제 사이트에서 버전 확인. 문구만 고치는 경우 버전 유지 여부는 사용자에게 물어볼 것.
- 커밋 사용자: `Mattkim91 <129262464+Mattkim91@users.noreply.github.com>`.
- 배포: `main` 푸시 시 `.github/workflows/pages.yml` 이 `VITE_BASE=/jp-clinic-interpreter/` 로 빌드해 https://mattkim91.github.io/jp-clinic-interpreter/ 에 올림.
- 모바일 우선(갤럭시 Chrome/삼성 인터넷, 아이폰 Safari). 390x844 한 화면 안에 맞게, safe-area 유지.
