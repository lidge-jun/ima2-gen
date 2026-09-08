---
created: 2026-09-08
updated: 2026-09-08
tags: [ima2-gen, devlog, docs, skills, wp4]
---

# 040 — WP4 문서 및 스킬 반영 (D8, D10, D17)

코드가 맞아도 문서가 틀리면 에이전트는 문서를 학습한다. `skills/ima2/SKILL.md`는
다른 AI 에이전트가 읽는 파일이므로, 여기 남은 '최대 7장'은 사람 한 명이 아니라
이 스킬을 읽는 모든 에이전트를 잘못 인도한다.

## 대상 파일

```
skills/ima2/SKILL.md                 ref2v 상한, 모델별 길이, V2V 모델 귀속
docs/CLI.md + ko/ja/zh-CN/zh-TW      video 명령 옵션과 상한
docs/API.md + 3개 번역               /api/video 계약
README.md + ko/ja/zh-CN/zh-TW        기능 요약의 숫자
site/src/pages/{,ko/}docs/...        providers.astro, api.astro
structure/01,02,03,04                파일-기능 맵과 명령/API 레퍼런스
```

번역본을 빠뜨리면 그 언어 사용자만 틀린 숫자를 본다. `rg -l "7"`로 훑지 말고
**ref2v 문맥의 7만** 골라 바꾼다 — 무관한 7이 훨씬 많다.

## skills/ima2/SKILL.md (D10)

현재 틀린 서술을 실측으로 교체한다.

```diff
-| Need 2+ character identity lock from separate refs | r2v (grok-imagine-video-1.5, max 7 refs, up to 15s, 720p) |
+| Need 2+ character identity lock from separate refs | r2v (grok-imagine-video-1.5, max 14 refs, up to 15s, 720p) |
-| 2-7 | r2v | 15s |
+| 2-14 | r2v | 15s (1.5) / 10s (base) |
```

### NEW 섹션: 모델별 능력 (D17)

지금 스킬은 두 비디오 모델을 해상도 차이로만 구분한다. 실제로는 **입력 모달리티가
갈라져 있고**, 그게 더 중요한 차이다.

```markdown
### Which video model can do what

|  | grok-imagine-video | grok-imagine-video-1.5 |
|---|---|---|
| text-to-video | yes | yes (via t2i then i2v) |
| image-to-video | yes | yes, native 1080p |
| reference-to-video | yes, max 10s | yes, max 15s |
| reference images | up to 14 | up to 14 |
| preset voices | **no** (400) | up to 3 |
| video editing | **yes** | no (400) |
| video extension | **yes** | no (400) |
| input modalities | text, image, video | text, image, audio |

The two models split on input: only the base model takes a video in, and only 1.5
takes audio in. There is no path that edits a video on 1.5. Do not route an edit
or extend request to 1.5 expecting a fallback; it returns 400.
```

### 프롬프트 태그 규약 정정

xAI 문서가 스스로 불일치한다. 이미지 예제는 `<IMAGE_1>`부터, 오디오는
`<AUDIO_0>`부터, 한 문장은 `<IMAGE_0>…`라고 쓴다. 우리
`lib/grokVideoPlannerPrompt.ts`가 실제로 무엇을 주입하는지 확인하고, 스킬 문서가
**우리 구현과 일치하는 쪽**을 적는다. 우리 코드가 진실이고 xAI 문서는 참고다.

### 연장 길이

```diff
-Extension: 2-10s
+Extension: 1-15s, and duration is the ADDED segment, not the total.
+xAI's own docs say 2-10; live probing accepts 1 and 11 and rejects 0 and 16.
```

## docs/CLI.md 계열

`ima2 video`, `ima2 video edit`, `ima2 video extend` 세 절의 숫자를 CLI 도움말
(020에서 고친 것)과 **동일한 문자열**로 맞춘다. 도움말과 문서가 다르면 어느 쪽이
최신인지 알 수 없다.

## docs/API.md 계열

`POST /api/video`의 `referenceImages` 상한, `referenceAudios` 제약, 모델별
`duration` 상한, 새 별칭을 반영한다. `capabilities` 응답 예시가 문서에 박혀 있다면
WP2에서 바뀐 필드(`durationRangeByModel`, `videoInputModes`, `customVoiceApi`)를
포함하도록 갱신한다.

## NEW: docs/xai-imagine-capability-matrix.md

숫자가 흩어져 있으면 다음 사양 변경 때 또 일부만 고친다. 한 장짜리 대조표를 두고
나머지 문서가 그걸 가리키게 한다.

```markdown
# xAI Imagine capability matrix
Last verified against api.x.ai: 2026-09-08 (devlog/_plan/260908_xai_imagine_spec_resync)

... (모델 x 모드 x 파라미터 표, 각 값에 근거 표기: [live] 또는 [docs])
```

`[live]`와 `[docs]`를 구분해 표기하는 게 핵심이다. ref2v 상한 14는 `[live]`이고
문서는 여전히 7이라고 말한다. 근거 종류를 적지 않으면 다음 사람이 문서를 보고
"14가 틀렸다"고 되돌린다.

## grok-imagine-image-quality 폐기 경고 (D8)

11월 2일에 폐기된다. 이번에 모델을 갈아치우지는 않되, **경고를 남긴다.**

- `lib/imageModels.ts`의 해당 상수 위에 폐기일과 대체 동작(2.0 + quality low)을 주석으로.
- `docs/xai-imagine-capability-matrix.md`에 폐기 예정 표기.
- `devlog/_plan/README.md`의 '외부 차단으로 미완료인 항목'이 아니라 **일정이 있는
  후속 작업**으로 별도 기록. 11월 전에 다시 봐야 한다.

기본 폴백 모델(`grokImageAdapter.ts`의 세 군데 `|| "grok-imagine-image-quality"`)을
지금 바꾸면 사용자의 기존 결과물과 단가가 조용히 달라진다. 그건 사양 동기화가
아니라 제품 결정이므로 이번 스코프 밖이다.

## structure/ 참조 문서

`01-file-function-map.md`에 새 파일(`ui/src/lib/droppedMedia.ts`,
`ui/src/components/VoicePicker.tsx`)과 새 함수를 등재한다.
`02-command-reference.md`와 `03-server-api.md`의 숫자를 맞춘다.

## 검증

```bash
npm test   # cli-skill-command-contract, skill-video-claims-contract 가 스킬 주장을 검사한다
```

`tests/skill-video-claims-contract.test.ts`가 이미 존재한다. 이 테스트가 새 숫자를
검사하도록 갱신하면, 문서가 코드와 갈라지는 걸 CI가 잡는다.

## 완료 조건

- ref2v 문맥의 '7'이 저장소 어디에도 남지 않는다(번역본 포함).
- 두 비디오 모델의 입력 모달리티 차이가 스킬 문서에 표로 있다.
- 모든 숫자에 `[live]`/`[docs]` 근거 종류가 붙는다.
- 폐기 예정 모델에 일정이 기록된다.



---

# 감사 반영 (002_wp1_audit.md) — stale 사본 인벤토리

감사가 찾은 실재 파일 목록이다. **하나라도 빠지면 그 표면만 틀린 값을 말한다.**

```
docs/API.md:404                       2-7
docs/CLI.md:245                       2-7, 1-10s
docs/{API,CLI}.{ko,ja,zh-CN,zh-TW}.md  같은 값의 번역본
docs/README.zh-CN.md:166              구 ref2v 범위
docs/README.zh-TW.md:160              동일
docs/README.ja.md:110                 동일
docs/README.ko.md                     확인 필요
docs/grok-video-i2v-research.md:120-128  1-10s ref2v, 2-10s 연장
site/src/pages/docs/concepts/providers.astro:177     2-7
site/src/pages/docs/concepts/modes.astro:56          max 10s
site/src/pages/ko/docs/concepts/{providers,modes}.astro  한국어판
skills/ima2/SKILL.md:879, 908, 1239-1245             7 refs, 2-10 연장
structure/01,02,03,04                 확인 필요
```

`docs/grok-video-i2v-research.md`는 성격이 다르다. 그건 **과거 시점의 조사
기록**이므로 값을 덮어쓰지 않고, 문서 상단에 "2026-09-08 재조사로 갱신됨,
현재 값은 260908 유닛 참조"라는 지시를 붙인다. 조사 기록을 소급 수정하면
그때 무엇을 알았는지가 사라진다.

