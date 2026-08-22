---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, evidence, live, phase4]
---

# 006 — wp4 CLI 실기 기록과 계획 정정 2건

## 040 문서의 지시 두 개를 따르지 않았다

P 단계 stale-check에서 040이 현재 코드와 어긋나는 지점을 둘 찾았다.
둘 다 **문서를 그대로 따랐다면 더 나쁜 결과**가 나왔을 것이다.

### 정정 1 — modelResolver 우회는 필요 없고, 넣으면 해롭다

040은 이렇게 적었다: "`bin/lib/modelResolver.ts`가
`deriveCliImageModelSet()`으로 모델을 검증하는데 comfy 모델은 거기 없다.
provider가 comfy일 때 검증을 건너뛰는 분기를 넣는다. 040의 유일한
비-comfy 파일 변경이다."

**틀렸다.** 현재 `modelResolver`는 파생 집합이 아니라 **라이브 lane
카탈로그**(`GET /api/models`)로 해석한다 — `knownLane`과 `modelExists`가
`catalog.lanes`를 읽는다. `docs/CLI.md:73-77`도 `ima2 gen`을 그 카탈로그
기반 fail-closed로 문서화한다.

wp3이 `comfyLane`에 등록 워크플로를 모델로 실었으므로
`ima2 gen --provider comfy --model <workflow>`는 **modelResolver를 한 줄도
고치지 않고** 해석된다. 게다가 우회를 넣었다면 검증을 **제거**하게 된다:

| 상황 | 지금 (우회 없음) | 040대로 우회했다면 |
|---|---|---|
| 오타난 워크플로 id | `MODEL_NOT_FOUND` (즉시) | 서버까지 가서 404 |
| 모든 인스턴스 오프라인 | `LANE_UNAVAILABLE` + 사유 | 통과 후 생성 실패 |

따라서 040의 유일한 비-comfy 파일 변경을 **불필요로 판정하고 뺐다.**

### 정정 2 — 파리티 정규식이 가리키는 목록이 다르다

040은 "`cli-feature-parity-contract.test.js:97`이 docs의 provider 목록을
대조하므로 comfy를 추가하지 않으면 실패한다"고 적었다.

그 정규식이 검사하는 건 `--provider <auto|...>` 형태의 **legacy 표면**
목록이다(edit/multimode/node). 그런데 wp3이 정확히 그 세 표면에서 comfy를
`COMFY_SURFACE_UNSUPPORTED`로 **거부**하게 만들었다.

거기에 comfy를 적으면 **코드가 의도적으로 거부하는 기능을 문서가 광고**하는
꼴이 된다. 대신 `ima2 gen`/`video`의 fail-closed lane 목록(:76)에 넣었다.

`tests/comfy-cli-contract.test.ts`가 이 구분을 고정한다: gen 목록에는
comfy가 있어야 하고, `--provider <auto|...>` 목록에는 **없어야** 한다.

## 실기 검증

스크래치 config로 별도 인스턴스를 띄웠다(사용자의 3333 서버는 건드리지
않았다). ComfyUI는 lidge를 18188로 터널링.

### PNG에서 바로 inspect

wp2가 만든 실제 ComfyUI PNG를 그대로 넣었다.

    $ ima2 comfy workflow inspect evidence/002_wp2_adapter_roundtrip.png
    7 nodes
      pick  prompt          6.text       CLIPTextEncode  "Positive"
      pick  prompt          7.text       CLIPTextEncode  "Negative"
      auto  width           5.width      EmptyLatentImage
      auto  height          5.height     EmptyLatentImage
      auto  seed            3.seed       KSampler
      auto  output          9            SaveImage

    Some fields have several candidates; pass them explicitly when adding, e.g. --prompt 6.text

제목이 "Positive"/"Negative"인데도 `pick`이다. 제목은 사용자가 자유롭게
바꾸는 값이라 신뢰 근거가 못 된다.

### --yes로도 모호성을 밀어붙일 수 없다

    $ ima2 comfy workflow add <png> --id cli-test --yes
    ✗ ambiguous bindings: prompt
    Run: ima2 comfy workflow inspect <png>
    Then pass each explicitly, e.g. --prompt <node>.<input>

`--yes`는 **이미 모호하지 않던** 후보만 수락한다. 잘못 찍으면 positive와
negative가 조용히 뒤바뀌고, 나중에 "모델이 프롬프트를 무시한다"로 나타나며
이 단계를 되짚을 단서가 없다.

### 등록과 생성

    $ ima2 comfy workflow add <png> --id cli-test --label "CLI Test" \
        --prompt 6.text --negative 7.text --origin http://127.0.0.1:18188
    ✓ cli-test -> http://127.0.0.1:18188
      use it with: ima2 gen "<prompt>" --provider comfy --model cli-test

    $ ima2 comfy workflow ls
    ID        LABEL     ORIGIN
    cli-test  CLI Test  http://127.0.0.1:18188  ready

    $ ima2 gen "a paper crane on a windowsill, overcast light" \
        --provider comfy --model cli-test
    ✓ /Users/jun/.ima2/generated/ima2-20260823-021447.png
    elapsed 2.9s

증거물: `evidence/004_wp4_cli_gen.png` (프롬프트와 내용 일치, 육안 확인).

**`ima2 gen`은 코드 변경 0줄로 동작했다** — 정정 1의 근거가 실증된 셈이다.

## 남은 것

`workflow bind`(등록 후 재바인딩)는 만들지 않았다. `add --replace`가 같은
일을 하고, 별도 명령은 그래프가 바뀌었을 때 부분 갱신이라는 더 복잡한
의미를 갖는다. 필요해지면 별도로 다룬다.
