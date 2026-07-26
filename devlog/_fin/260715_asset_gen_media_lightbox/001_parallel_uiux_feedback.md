---
title: 병렬 UIUX 피드백과 A 감사 종합
date: 2026-07-15
tags: [ima2-gen, asset-gen, uiux, audit, luna]
status: complete
---

# 001 — 병렬 UIUX 피드백과 A 감사 종합

## Lanes

- Bacon — PABCD A plan audit, gpt-5.6-luna low.
- Planck — interaction/accessibility critique, gpt-5.6-luna low.
- Plato — desktop/mobile/video/zoom critique, gpt-5.6-luna low.

모두 read-only로 현재 source와 000/010 계획을 독립 검토했다.

## Shared recommendation

세 보고서는 전용 AssetMediaLightbox, nearest-component state, media-only button, 기존 focus hook 재사용, card keying/retry 분리에 동의했다. 전역 GalleryModal 재사용이나 새 package는 불필요하다는 결론도 같았다.

## Accepted amendments

1. empty prompt/unknown mediaType에도 trigger와 dialog name이 사라지지 않도록 image/video localized fallback을 명시했다.
2. video는 muted best-effort autoplay + native manual-play fallback으로 정하고 item.thumb가 있을 때만 poster를 쓴다.
3. close callback identity, first-focus close button, trigger unmount 시 optional restoration boundary를 명시했다.
4. zoom은 fixed-size stage 안 200% media, overflow auto, overscroll containment, touch pan으로 제한했다.
5. transparent keyed item은 image가 아니라 lightbox stage에 checkerboard를 둔다.
6. mobile safe-area formulas, 44px controls, z-index 260, reduced-motion query, touch에서 persistent hint를 계획에 추가했다.
7. keying button 실제 activation과 retry sibling source contract, nested result scrollTop non-movement를 C 증거로 추가했다.

## Rebutted or bounded suggestions

- 001/011 파일명이 decade convention 위반이라는 지적은 반박했다. 사용자가 정한 000-009 테스트·조사, 010-019 Phase 1 계획/검증 규칙과 cxc-pabcd lexicographic separation에 맞는다.
- 별도 poster 생성은 GenerateItem에 보장된 poster가 없고 scope를 넓히므로 하지 않는다. 기존 optional thumb만 사용한다.
- native video shadow controls 전체를 custom focus selector에 넣는 것은 불가능하며 불필요하다. custom close path와 document Escape를 보장하고 실제 keyboard 관찰에서 경계를 기록한다.
- 기존 44px 미만 keying/retry button의 전면 교정은 이번 lightbox scope 밖이다. 새 close/zoom과 full media trigger만 44px 기준을 충족한다.

## Main-agent verdict after synthesis

High 4건은 모두 010에 수용하거나 근거와 함께 반박했다. 남은 항목은 구현·C observation에서 확인할 비차단 검증 포인트다. 같은 A reviewer에게 amended plan을 재감사시킨다.

## A round 2

같은 Bacon reviewer가 amended plan을 다시 읽고 autoplay, numbering, unknown media fallback, keying/retry regression proof 네 High가 모두 닫혔다고 확인했다. focus lifecycle, zoom containment, stacking/safe area, checkerboard, aria naming은 구현과 C에서 확인할 명시적 비차단 증거 항목으로 남겼다.

VERDICT: PASS
