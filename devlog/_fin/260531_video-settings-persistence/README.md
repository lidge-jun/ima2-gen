
## Closeout (2026-07-11, 260711_production-hardening WP4)

권장 수정이 코드에 반영 완료된 것을 확인: persistenceRegistry.ts(ima2.videoDefaults),
storePersistence.ts(load/save+fallback), useAppStore.ts(초기 복원+setter 저장),
storeSettingsImpl.ts(selectVideoModel/이미지 전환 저장), storeUIImpl.ts(탭 간 sync).
계약 테스트: tests/video-defaults-persistence-contract.test.js (7 pass).
