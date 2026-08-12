# 011 — WP1 활성화 증거 (이슈 #119)

측정일 2026-08-03 / 대응 기준 `c-scroll-activation`, `c-gates`

## 실행 환경

| 항목 | 값 |
|------|-----|
| 서버 | `node server.js` 직접 실행 (싱글톤 가드 우회) |
| 격리 | `IMA2_PORT=13399`, `IMA2_CONFIG_DIR`/`IMA2_GENERATED_DIR`/`IMA2_ADVERTISE_FILE`를 `mktemp -d` 하위로, `IMA2_NO_OAUTH_PROXY=1`, `IMA2_NO_GROK_PROXY=1` |
| 기동 확인 | `HTTP=200` |
| 브라우저 | agbrowse (로컬 Chrome/CDP), 뷰포트 1280×633 |
| 관측 대상 | `#sidebar-generation-model` (사이드바 이미지 모델 드롭다운) |

관측은 전부 `evaluate(발생)` → `wait` → `evaluate(읽기)` 3단계로 분리했다.
React 19 자동 배칭 때문에 dispatch 직후 같은 evaluate에서 읽으면 커밋 전 값을 읽는다.

## 선행 확인 — 목록이 실제로 스크롤되는가

```
{"present":true,"expanded":"true","scrollHeight":586,"clientHeight":418,"scrollable":true}
```

`586 > 418`이므로 내부 스크롤이 실제로 발생하는 조건이다. 이 확인 없이는 "닫히지 않았다"가
"스크롤이 없었다"와 구분되지 않는다.

## Baseline — 수정 전 동작에서 버그 재현

`Select.tsx`를 수정 전 형태(무가드 `close`를 캡처 스크롤에 등록)로 되돌리고 UI를 재빌드한
뒤 같은 절차를 실행했다.

| 단계 | 관측 |
|------|------|
| 드롭다운 열기 | `{"present":true,"expanded":"true","scrollable":true}` |
| 내부 스크롤(`scrollTop=60`) 후 | **`{"expanded":"false","listPresent":false}`** |

목록 내부를 스크롤하자 메뉴가 닫히고 포털 목록이 언마운트됐다. 이슈 #119 신고 증상이
그대로 재현된다.

## Patched — 수정 후 동작

가드를 복원하고 UI를 재빌드한 뒤 동일 절차.

| 단계 | 관측 | 판정 |
|------|------|------|
| 내부 스크롤(`scrollTop=60`) 후 | `{"FINAL_expanded":"true","listPresent":true,"scrollTop":60}` | ✅ 메뉴 유지, 스크롤 실제 발생 |
| 외부 스크롤(`.sidebar__scroll`) 후 | `{"expanded":"false","listPresent":false}` | ✅ 정상 닫힘 (#79 회귀 없음) |

baseline과 patched가 같은 입력에 정반대 결과를 낸다. 가드가 실제로 발화하며, 발화가
사용자 관측 동작을 바꾼다는 것이 증명된다.

## 단위 테스트 반증 확인

`shouldDismissOnScroll`의 내부-타깃 분기를 반대로 뒤집는 ablation을 적용한 결과:

```
✖ scroll raised inside the portaled list keeps the menu open
✖ scroll raised on a descendant of the list also keeps the menu open
✔ scroll raised outside the menu still dismisses it
✔ document-level scroll dismisses the menu
✔ a window target without nodeType dismisses instead of throwing
✔ a missing menu ref or missing event falls back to dismissing
✔ the portaled Select registers the guarded scroll handler
pass 5 / fail 2
```

정확히 가드가 담당하는 두 케이스만 실패했다. 테스트가 이 분기를 실제로 감시한다.
ablation 원복 후 7/7 통과.

## 게이트 결과

| 명령 | 종료코드 |
|------|---------:|
| `node scripts/classify-tests.mjs` (인벤토리 재생성) | 0 |
| `npm run test:inventory` | 0 |
| `node scripts/refresh-structure-line-counts.mjs --check` | 0 (`line counts are current`) |
| `npm run typecheck` | 0 |
| `npm run typecheck:tests` | 0 |
| `npm run build:server` | 0 |
| `npm run build:cli` | 0 |
| `npm --prefix ui run build` | 0 |
| `npm test` | 0 — **tests 2050 / pass 2048 / fail 0 / skipped 2** |

첫 전체 실행에서는 `tests/mcp-provider-ui-contract.test.js:153`이 옛 무가드 배선
(`window.addEventListener("scroll", close, true)`)을 정규식으로 고정하고 있어 실패했다.
그 계약의 의도는 "스크롤 시 닫힌다"이지 "무가드여야 한다"가 아니므로, 새 핸들러 이름과
가드 호출을 함께 요구하도록 갱신했다.

## teardown

| 항목 | 결과 |
|------|------|
| 서버 SIGINT 후 포트 13399 | `AFTER_TEARDOWN=000` (닫힘) |
| `agbrowse stop` | `Chrome stopped` |
| 임시 격리 디렉터리 | 휴지통으로 이동 (복구 가능), 존재 확인 결과 삭제됨 |
| 스크린샷 | `/Users/jun/.browser-agent/screenshots/screenshot_1785771807160.png` |

## 남은 한계

- 관측은 macOS + Chrome 단일 환경이다. 신고 환경(Ubuntu + Chrome)에서의 재검증은 하지 않았다.
  다만 결함과 수정이 모두 DOM 이벤트 경로 레벨이라 브라우저 엔진이 같으면 동일하게 동작한다.
- 휠 입력 대신 `scrollTop` 변경 + `scroll` 이벤트 디스패치로 구동했다. 캡처 단계 경로는
  동일하지만 실제 휠 제스처의 관성 스크롤까지 재현하지는 않았다.
