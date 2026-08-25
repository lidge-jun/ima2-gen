---
created: 2026-08-25
tags: [ima2-gen, devlog, roadmap, issues, cli-ergonomics]
---

# 000 — 이슈 4건 + PR 3건 배치 로드맵

## Loop spec

- Archetype: spec-satisfaction repair. 각 이슈가 자기 재현 절차를 갖고 있으므로
  검증자가 명확하다.
- Trigger: 사용자가 실사용 중 발견해 #170~#173을 올렸고, 열린 PR 3건이 남아 있다.
- Goal: open issue 0 / open PR 0.
- Verifier: **각 이슈 본문의 재현 절차를 그대로 실행한다.** 고치기 전에 실패를,
  고친 뒤에 통과를 보인다. 여기에 5종 게이트.
- Non-goals: npm publish, release, main PR, GPT OAuth 레인 자체의 크기 정확도 개선
  (#173은 명시적으로 '고쳐라'가 아니다).

## 이슈별 실측 진단

### #170 — `-d` + `-o` 조합에서 `-d`가 무시된다

    bin/commands/gen.ts:225
    const target = args.out ? String(args.out)
      : args["out-dir"] ? join(String(args["out-dir"]), result.filename)
      : undefined;

`args.out`이 있으면 삼항이 즉시 종료돼 `--out-dir`을 **쳐다보지도 않는다.** 상대
경로는 cwd 기준으로 해석되므로 사용자가 지정한 디렉터리가 조용히 사라진다.

사용자가 제안한 3안 중 **1안(상대 경로면 -d 기준 해석)** 을 택한다. 2안(에러)은
기존 사용자의 스크립트를 깨고, 3안(로그만)은 증상을 보이게 할 뿐 원인을 두는 것이다.
다만 3안도 **함께** 한다 — 절대 경로 로깅은 그 자체로 개선이고, 사용자가 "항상
절대 경로를 찍었다면 이 버그가 바로 보였을 것"이라고 정확히 지적했다.

### #171 — `video frame`이 로컬 경로를 못 받는다

프레임 추출은 **서버**가 한다. `lib/videoFrameExtract.ts`의 경로 해석이
generated dir 안으로 제한되고(경로 이탈 방어), 벗어나면 `video file not found`다.
즉 서버는 사용자의 cwd에 있는 파일을 애초에 볼 수 없다.

따라서 "경로를 넘긴다"가 아니라 **바이트를 올린다**가 옳은 해법이다. CLI가 로컬
파일을 감지하면 업로드해서 추출한다. generated filename은 기존대로 동작한다.
에러 메시지도 받는 형식을 명시하도록 고친다.

### #172 — video 메타데이터에 mode가 없다

    routes/video.ts:368-388  mode가 이미 서버에서 해석된다
    routes/video.ts:395      inflight meta에는 들어간다
    routes/video.ts:593      sidecar video 객체에는 mode가 빠져 있다

판정 로직은 이미 있고 **기록만 안 된다.** inflight는 진행 중에만 살아 있어
완료 후에는 조회 불가다. sidecar에 `mode`를 추가하고 `sourceImageFilename`이
실제로 채워지는지 확인한다.

### #173 — 크기 nudge와 가시성

사용자가 프레이밍을 정확히 했다: OAuth 레인의 한계는 ima2가 고칠 수 없다.
3가지 제안 전부 수용한다.

1. `--size` 지정 시 프롬프트에 비율 문장 자동 추가. `--no-size-nudge` 탈출구.
   선례: `--bg transparent`가 이미 같은 방식으로 프롬프트를 보강한다.
2. 요청≠실제면 경고 한 줄. 성공 로그에 실제 픽셀 크기를 항상 표기.
3. 메타데이터에 `requestedSize` / `actualSize` 분리.

## Dependency-ordered work-phase map

| WP | decade | 결과 |
|---|---|---|
| wp6 | 000 | 본 로드맵 |
| wp7 | 010 | #170 경로 해석 + 절대 경로 로깅 |
| wp8 | 020 | #171 로컬 파일 업로드 경로 |
| wp9 | 030 | #172 sidecar mode 기록 |
| wp10 | 040 | #173 nudge + 드리프트 경고 + 메타 분리 |
| wp11 | 050 | PR 병합 + 이슈 종료 → 0/0 |

wp7과 wp10은 둘 다 `bin/commands/gen.ts`를 만지므로 순서가 있다. wp8/wp9는 독립적이다.

## Accept criteria

각 이슈 본문의 재현 절차가 수정 전 실패 / 수정 후 통과. 5종 게이트 green.
최종적으로 `gh issue list`와 `gh pr list`가 0건.

## #150 처리 방침

Provider Adapter v1 RFC 우산 이슈다. 실제 구현 상태를 확인한 뒤 판단한다:
어댑터가 이미 랜딩했다면 근거와 함께 닫고, 남은 항목이 있으면 **열어둔 채 사유를
적는다.** 0/0을 위해 미완 작업을 닫는 것은 정직하지 않다.
