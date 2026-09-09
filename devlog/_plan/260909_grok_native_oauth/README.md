---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, xai, oauth, progrok]
---

# 260909_grok_native_oauth

Grok 레인을 progrok 자식 프로세스 프록시에서 네이티브 xAI OAuth 직접 호출로 전환한다.

| 문서 | 내용 |
|---|---|
| 000_plan.md | 결정 R1~R12, WP 지도, 위험, 범위 |
| 001_opencodex_port_spec.md | OpenCodex xai.ts 이식 사양, 결함 감사 D1~D9 |
| 002_callsite_inventory.md | 프록시 도달 경로 전수 |
| 003_removal_blast_radius.md | 제거 blast radius |
| 004_xai_docs_aside_research.md | docs.x.ai·discovery·progrok 원본 조사 |
| 010_wp2_xai_auth.md | lib/xaiAuth.ts |
| 020_wp3_direct_lane.md | 레인 전환 |
| 030_wp4_remove_progrok.md | 제거·CLI·readiness |
| 040_wp5_docs_sot.md | SoT·문서 |
| 050_verification.md | 게이트·스택·증거 |

선행: `260819c_grok_proxy_supervision` (wp5에서 _fin으로 아카이브, superseded).
