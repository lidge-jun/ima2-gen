# 020 — wp2: 문서/스킬 이관 + 버전 범프 (diff-level)

전제: wp1 계약 확정. breaking change(fail-closed)의 파손면 전수 이관 — Mind 스캔이 file:line까지 확정한 체크리스트.

## 1. 패키지 스킬 (MODIFY)

- `skills/ima2/SKILL.md:45-51` — bare `ima2 gen` 퀵스타트 → defaults 선설정 플로 + NO_DEFAULT_MODEL 봉투 해설.
- `skills/ima2/SKILL.md:551-554, 624-644, 1149-1156` — video Grok 전용 서술 → 레인 id 문법, `ima2 models`, MCP wait, exit code 계약(2/3/1) 반영. 문서상 기본 모델 표기(grok-imagine-video-1.5 vs 코드 base) 정정.
- `skills/ima2-front/SKILL.md:189, 227-250` + `references/asset-requirements.md:174-204, 236-240` — bare gen 폴백 서술을 defaults 전제로 갱신(병렬 배치 예시 포함).
- `skills/ima2-uiux/SKILL.md:277-309, 379-395` — 동일.
- 스킬 내 예시 명령 전수 grep: `rg -n "ima2 (gen|video)" skills/` 0건의 bare 잔존이 accept 조건.

## 2. README / site (MODIFY)

- `README.md:36-37, 241-259, 344` — 퀵스타트·CLI 예시·OAuth 트러블슈팅의 bare 호출 갱신(진단 예시는 `--model oauth/<default>` 명시로).
- `site/src/pages/docs/reference/cli.astro:44-72` + `ko/docs/reference/cli.astro:44-70` — models/defaults 명령 추가, fail-closed 계약 섹션 신설.
- `site/src/pages/docs/concepts/modes.astro:70-75`, `docs/concepts/providers.astro:98` — video 예시 갱신, MCP 레인 소개.

## 3. 버전/체인지로그 (MODIFY)

- `package.json` 2.x → 3.0.0, CHANGELOG(또는 릴리즈 노트 초안)에 BREAKING 섹션: fail-closed, 레인 id, models/defaults 신명령, exit code 계약.
- npm publish는 범위 밖 — 사용자 승인 후 별도.

## 4. structure 문서 (MODIFY)

- `structure/01-file-function-map.md` — 신규 bin/lib/modelResolver.ts, mcpJob.ts, commands/models.ts 반영.

## Accept (wp2)

1. `rg -n "ima2 (gen|video) " skills/ README.md site/ | bare 호출 0건` (플래그/defaults 문맥 제외 규칙 명시).
2. site en/ko 빌드 통과(`cd site && npm run build` 상당), 스킬 라인수 계약 테스트 green.
3. 버전 3.0.0 + BREAKING 노트 존재.
