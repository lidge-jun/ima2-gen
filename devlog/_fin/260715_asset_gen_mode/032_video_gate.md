---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, video, verification, wp9]
status: diff-level 확정 (WP9)
---

# 032 — WP9: 비디오 n≥3 재검증 + WebM 썸네일/히스토리 연결

T1 PASS는 n=1 (Mind MEDIUM: 재현성 미보증). WP9가 재검증을 소유한다.
또한 WebM은 `imageThumb` 미지원(PNG/JPEG/WebP만, `lib/imageThumb.ts:9-15`)이라
썸네일 연결이 필요 (ASSUMPTION 10).

## 파일 변경 맵

### NEW — `scripts/verify-chroma.mjs` (~120줄)

001 측정 프로토콜의 스크립트화: 입력(mp4|png) → (mp4면 ffmpeg 3프레임 추출) →
sharp 8점 샘플 → green-dominant 비율 + 프레임 간 ΔRGB 출력, exit 0/1.
020/030/032의 C 게이트가 공통 사용. `package.json` scripts에
`"verify:chroma": "node scripts/verify-chroma.mjs"` 추가.

### MODIFY

| 파일 | 변경 |
|---|---|
| `lib/imageThumb.ts` 또는 파생 등록부(`routes/videoKeying.ts`) | keyed-webm 등록 시 원본 mp4의 기존 프레임 썸네일 경로를 asset metadata.thumbnail로 재사용 — imageThumb 자체는 무변경 (WebM 디코딩 도입 금지) |
| `ui/src/components/assets/*(썸네일 렌더 지점)` | asset.metadata.thumbnail 우선 사용하는 분기 (WebM 카드) + 재생 아이콘 오버레이 |
| `ui/src/store/storeHistoryImpl.ts` | 변경 없음 예상 — 파생 WebM은 히스토리 독립 항목으로 자연 노출 (ASSUMPTION 정책); 파생 배지는 assets 카드에서만 |
| `001_video_chroma_test.md` | n=3 재검증 결과 추가 기록 (T1-2, T1-3, T1-4) |

## 재검증 프로토콜 (WP9 C에서 실행)

- 서로 다른 피사체 3종 (기물/생물/텍스트 로고) × 크로마 프리셋 비디오 생성 → `verify:chroma` 전부 PASS (≥95% green-dominant, ΔRGB≤15).
- 각각 WebM 키잉까지 완주 → yuva420p 확인.
- 1건이라도 FAIL: 프롬프트/constraint 문구 보강 1회 재시도 → 재실패 시 001에 실패 모드 기록 + NEEDS_HUMAN (기본값 조정 판단).

## Accept criteria (WP9 C 게이트)

1. `verify:chroma` 스크립트가 T1 원본 mp4에서 PASS 재현 (도구 자체 검증).
2. 신규 3건 생성 전부 PASS + WebM 3건 yuva420p (측정 로그 캡처).
3. assets 탭에서 WebM 카드가 mp4 프레임 썸네일 + 재생 오버레이로 렌더 (스크린샷).
4. typecheck + npm test + ui build.
