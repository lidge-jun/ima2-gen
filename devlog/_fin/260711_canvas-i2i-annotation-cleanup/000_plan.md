# 260711 — 캔버스 i2i 노트(주석) 잔존 문제 개선

Date: 2026-07-11
Session: cxc-loop goalplan `canvas-i2i-annotation-cleanup-memo-notes-arrows`
Status: DONE

## 문제

Prompt Studio 캔버스에서 메모(노트)·화살표·박스를 그린 뒤 i2i 생성을 하면
결과물에 노트/마크업이 남는 경우가 있다 ("노트 같은게 잘 안없어지는 문제").
#96(0509f65)에서 clean 소스 라우팅을 한 번 고쳤지만 잔존 경로가 남아 있었다.

## 작업 구성

| WP | 내용 | 상태 |
|---|---|---|
| wp1 | 로컬 RCA — 주석 픽셀이 모델 페이로드에 닿는 전 경로 추적 | done |
| wp2 | sol 탐사대 리서치 (주석 이미지 i2i 지침 + 제거 편집 프롬프트) | done |
| wp3 | 수정 구현 (지시문 강화, clean 라우팅, 컴포저 칩, 문서) | done |
| wp4 | 검증 + closeout | done |

산출물: `010_rca.md`, `020_claim-ledger.md`, `090_closeout.md`
