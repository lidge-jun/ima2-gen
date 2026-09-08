---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, grok, xai, moc]
---

# 260908 xAI Imagine 사양 재동기화

사용자 보고: "Grok 이매진이 또 ref2v 사양 업데이트했고 1.5 중간 태그 같은 것도
늘어났다." 실측으로 확인한 결과 **레퍼런스 이미지 상한이 7 -> 14로 두 배**가
됐고(@imagine 2026-09-02 공식 발표), ref2v 길이 상한이 모델별로 갈라졌으며,
이미지 레인에도 미반영 변경이 여러 건 있었다.

## 문서

| 문서 | 내용 |
|---|---|
| `000_research.md` | 1차 실측 + 공식문서. D1-D11 델타. V2V 부록 |
| `001_v2v_and_hidden_surface.md` | 편집/연장 모델 귀속, 숨은 엔드포인트, SDK 격차, GUI 갭, @imagine 발표. D12-D17 |
| `002_wp1_audit.md` | 독립 감사 결과와 로드맵 정정 (blocker 3 + should-fix 6) |
| `010_wp2_server_contract.md` | WP2 서버 계약 |
| `020_wp3_client_cli.md` | WP3 UI/CLI |
| `030_wp35_gui_inputs.md` | WP3.5 GUI 오디오/동영상 입력 + 드래그앤드랍 |
| `040_wp4_docs_skills.md` | WP4 문서/스킬 |
| `050_wp5_verification.md` | WP5 검증 게이트 |
| `evidence/` | HTTP 프로브 원본, 모델 목록 스냅샷, 뉴스/X 조사 |

각 WP 문서는 본문 뒤에 "감사 반영" 절을 갖는다. **충돌하면 감사 절이 이긴다.**

## 핵심 사실 (2026-09-08 실측 기준)

| 값 | 이전 | 현재 | 근거 |
|---|---|---|---|
| ref2v 레퍼런스 이미지 | 7 | **14** | live 400 + @imagine 발표 |
| ref2v 길이 (1.5) | 15s | 15s | live |
| ref2v 길이 (base) | (구분 없음) | **10s** | live |
| reference_audios | 3, 1.5 전용 | 동일 | live |
| 비디오 연장 길이 | 2-10 (문서) | **1-15** | live |
| 이미지 편집 입력 | 3 | **5** | live + 릴리스노트 |
| 1.5 별칭 | -preview | **+ -2026-05-30** | 모델 목록 |
| 영상 입력 (edit/extend) | base 전용 | 동일, 1.5는 400 | live |

## 미판정으로 남긴 것

- 편집/연장의 추가 필드 수용 여부 — 안전한 트립와이어를 세울 수 없었다
- 업로드 오디오 클립의 계정 등급 (trusted partners 게이팅)
- `generate_audio` 필드 — 가이드에만 있고 REST/OpenAPI에 없다
- I2V `aspect_ratio`의 실제 동작 — 문서 두 곳이 충돌

