---
title: 미디어 라이트박스 검증과 closeout
date: 2026-07-15
tags: [ima2-gen, asset-gen, lightbox, verification]
status: complete
---

# 011 — 미디어 라이트박스 검증과 closeout

## Static gates

- node --test tests/asset-gen-media-lightbox-contract.test.js tests/asset-gen-keying-preview-contract.test.js — 12/12 pass, exit 0.
- npm run typecheck — exit 0.
- npm run typecheck:tests — exit 0.
- cd ui && npm run build — 515 modules, exit 0. 기존 dynamic/static import와 500 kB chunk warning만 유지.
- npm run test:inventory — 88 runtime / 144 contract, exit 0.
- git diff --check on scoped tracked files — exit 0.
- line counts: AssetMediaLightbox 116, AssetGenWorkspace 182, assetgen-workspace.css 114, lightbox contract test 91. 모두 repo limit 아래다.

## Parallel UIUX and audit

- Bacon, Planck, Plato를 모두 gpt-5.6-luna low read-only로 실행했다.
- 공통 결론은 dedicated local lightbox, media-only trigger, existing focus hook reuse였다.
- autoplay, unknown media, action separation, safe area/zoom containment 네 High를 010에 접어 넣었다.
- 같은 Bacon reviewer의 round 2: VERDICT PASS, High/Critical residual 0.

## Render and activation evidence

- exact 1280×720 image popup: evidence/desktop-image-open.png.
  - panel left/right 90/1190, top/bottom 16/704.
  - keyed checkerboard true, image natural 1024×1024.
  - fit stage client/scroll = 1099×560, 가로·세로 overflow 0.
- exact 390×844 image popup: evidence/mobile-390-image-open.png.
  - panel left/right 8/382, top/bottom 8/836, document scroll width 390.
  - close 44×44, zoom 73×44, stage client/scroll 373×699.
- desktop 2× image: evidence/desktop-image-zoomed.png.
  - aria action이 화면에 맞춤으로 전환되고 stage overscroll-behavior=contain.
  - 모바일 stage scrollTop 0→27.5 동안 window.scrollY 0, results.scrollTop 95.625 고정.
- exact 1280×720 video popup: evidence/desktop-video-open.png.
  - 실제 generated alpha WebM 720×720, readyState 4, controls=true, muted=true, paused=false, currentTime>0.
- Escape close 뒤 dialog count 0, body/root overflow 원복, active element가 정확한 image trigger로 복귀했다.
- 배경 제거 sibling button activation은 lightbox count 0, keying panel count 1을 만들었다.
- browser warn/error 0.
- QA는 실제 generated PNG/WebM을 주입하는 temporary Vite harness로 수행했고, harness 파일과 서버를 모두 제거/종료했다.

## Full-suite context

npm test — 1,286개 중 1,283 pass, 3 fail, exit 1. 세 실패는 현재 병렬 작업의 기존 불일치이며 이 유닛 파일과 무관하다.

1. docs/API.md에 /api/assets/promote-element 누락.
2. node template uploadPath placeholder 기대와 구현 불일치.
3. structure/01의 lib/multimodePipeline.ts line count doc=487, actual=535.

이 유닛은 해당 파일을 수정하거나 되돌리지 않았다.

## Scoped adversarial audit

- global GalleryModal/API/store schema를 건드리지 않았다.
- unknown mediaType은 기존처럼 image fallback이다.
- backdrop은 panel 밖이고 focus trap은 panel 안 close/zoom만 순환한다.
- native video shadow controls는 custom selector가 열거하지 않지만 document Escape와 visible close가 동작한다.
- temporary harness 부재, scoped diff whitespace, modular line limits를 다시 확인했다.

## Pessimist record

- media fit/zoom/playback만 개선했으며 생성 품질, keying 알고리즘, poster 생성은 개선하지 않았다.
- browser native video controls의 세부 키보드 동작은 브라우저 구현에 귀속된다.
- 실제 390 viewport에서 document width가 390을 넘거나 fit stage scroll size가 client보다 커지는 재현이 생기면 DONE을 철회한다.

## Terminal outcome

DONE — 이미지 확대와 비디오 popup 재생, 접근성 close/focus 경로, desktop/mobile containment, sibling action 분리를 실제 media와 fresh gates로 확인했다.

