# 010 — Claim Ledger (wave 1 + wave 2)

수집 원칙: cxc-search ladder. Tier 2 = 원문을 실제로 열어 확인한 claim만.
스니펫 합의는 증거로 승격하지 않았다. 각 탐사대는 hosted `web_search`가
404를 반환해 native browser fallback으로 원문을 열었다(각 반환문에 명시).
`agbrowse fetch --browser never`는 developers.openai.com에서 rss.xml로
미스라우팅되는 문제가 있어 해당 응답은 기각되었다.

## Wave 1 (2026-07-11) — 5 explorers (gpt-5.6-sol)

### E1 Gibbs — OpenAI 공식 (모델 발표/카이드 존재 확인)

| Claim | 출처 | Tier |
|---|---|---|
| 4o/GPT Image는 상세 프롬프트 추종·객체-속성-관계 바인딩 강화 | https://openai.com/index/introducing-4o-image-generation/ (2025-03-25) | T2 |
| 종횡비, hex 색상, 투명 배경을 프롬프트로 명시 가능 | 같은 문서 | T2 |
| 공식 예시 프롬프트 자체가 `Context`/`Characters`/`Composition` 라벨 블록 사용 | 같은 문서 | T2 |
| gpt-image-1.5 전용 Prompting Guide 존재 (2025-12-16) | https://developers.openai.com/cookbook/examples/multimodal/image-gen-1.5-prompting_guide | T2(존재), 본문은 E2가 raw로 확인 |

### E2 Russell — 구조화 포맷 실증

| Claim | 출처 | Tier |
|---|---|---|
| OpenAI 공식 필드 순서: background/scene → subject → key details → constraints; 복잡한 프롬프트는 라벨 세그먼트/줄바꿈 | https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/multimodal/image-gen-1.5-prompting_guide.ipynb (2025-12-16) | T2 |
| 공유 필드: scene, subject, 재질/디테일, medium, composition/viewpoint, lighting/mood, placement, constraints + 용도(ad/UI/인포그래픽)가 "mode"를 결정 | 같은 문서 | T2 |
| 리얼리즘에는 lens/framing/lighting이 "8K/ultra-detailed" 같은 토큰보다 신뢰됨 | 같은 문서 | T2 |
| 과적재 대신 반복 정제: 시작은 깔끔하게, 한 번에 한 변수 | 같은 문서 | T2 |
| FLUX.2 공식: JSON과 자연어는 동등하게 이해됨. JSON은 자동화/복잡한 다주체/일관성 용도, 단순 장면·탐색은 자연어 권장 | https://docs.bfl.ml/guides/usecases_t2i_json_prompting.md (2026-04-27) | T2 |
| FLUX 실용 길이 30-80 단어; 32K 토큰 지원해도 단어 수가 품질을 자동 향상시키지 않음 | https://docs.bfl.ml/guides/prompting_unified_building.md (2026-05-14) | T2 |
| 필드 순서는 벤더별 상이(OpenAI scene-first, FLUX subject-first) → 순서는 우선순위 신호이지 불변 문법이 아님 | 위 두 문서 | T2 |
| Imagen 가이드: subject/context/style/camera/lighting/lens/quality modifier/aspect/exclusion 구조 | https://cloud.google.com/vertex-ai/generative-ai/docs/image/img-gen-prompt-guide (2026-07-07) | T2 |

### E3 Euclid — 텍스트 렌더링

| Claim | 출처 | Tier |
|---|---|---|
| 문자 그대로의 텍스트는 인용부호 또는 ALL CAPS + 타이포(폰트 스타일/크기/색/배치)를 제약으로 명시 | https://cookbook.openai.com/examples/multimodal/image-gen-models-prompting-guide#2-prompting-fundamentals (2026-04-21) | T2 |
| 정확한 카피에는 `EXACT, verbatim, no extra characters` + 인용 텍스트 + 1회만 표기 요구 | 같은 문서 #55 | T2 |
| 어려운 단어/브랜드명은 letter-by-letter 스펠링으로 문자 정확도 개선 | 같은 문서 #2 | T2 |
| 작은 텍스트·밀집 패널·멀티폰트 레이아웃엔 medium/high quality 권장 | 같은 문서 #2 | T2 |
| 로컬라이제이션 편집: 텍스트 외 전부 보존, verbatim 번역, 단어 추가 금지, 불필요한 reflow 회피 | 같은 문서 #42 | T2 |
| 정확한 배치·텍스트 선명도는 여전히 한계로 공식 문서화됨 | https://platform.openai.com/docs/guides/image-generation#limitations | T2 |
| CJK 글리프는 복잡도 때문에 부정확/비인식 문자가 잦음(일반 연구 근거) | https://arxiv.org/abs/2408.10623 (2024-08-20) | T2 |
| 한국어 전용 공식 가이드는 부재 (negative finding) | 상동 | T2 |
| "단어 줄이기/글자 키우기/다중 후보"는 합리적 운영 완화책이나 공식 규칙으로 문서화되진 않음 | 상동 | 추론 |

### E4 Hooke — 편집/i2i/레퍼런스

| Claim | 출처 | Tier |
|---|---|---|
| 편집은 "change only X" + "keep everything else the same" 페어가 공식 권장 | https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide/ | T2 |
| 보존 언어: identity/geometry/layout/camera/lighting/label 불변 조건을 매 반복 재명시 | 같은 문서 | T2 |
| 편집 프롬프트가 항상 최종 이미지를 전부 기술할 필요는 없음 — scene/context + 변경 + 보존 제약의 구조화 브리프가 공식 형태 | 같은 문서 | T2 |
| 멀티 레퍼런스는 인덱스+역할로 지칭 (`Image 1: product photo`, `Image 2: style reference`) 후 관계를 명시 | 같은 문서 | T2 |
| 합성(compositing)은 소스 요소/대상 위치/보존 컨텍스트/조화(스케일·원근·조명·그림자) 명시 | 같은 문서 | T2 |
| 마스크는 첫 번째 이미지에 적용되며 픽셀 정밀 경계가 아닌 soft guidance | https://developers.openai.com/api/docs/guides/image-generation/ | T2 |
| `input_fidelity="high"`는 얼굴/로고/텍스처 보존 개선; 멀티 ref에선 첫 입력이 최고 디테일 보존 → identity-critical 입력을 첫 번째로 | https://developers.openai.com/cookbook/examples/generate_images_with_high_input_fidelity/ (2025-07-17) | T2 |
| 다수의 중요 얼굴은 하나의 합성 레퍼런스로 합쳐 제출 권장 | 같은 문서 | T2 |

### E5 Harvey — 어휘/네거티브/안티패턴

| Claim | 출처 | Tier |
|---|---|---|
| shot type/viewpoint/lighting/placement은 신뢰 가능한 조향 어휘 (close-up/wide/top-down, eye-level/low-angle, negative space 위치 지시 포함) | https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide (2026-04-21) | T2 |
| 정밀 카메라 스펙(mm, Kelvin)은 느슨하게 해석될 수 있음 — look cue로 취급 | 같은 문서 | T2 |
| 구체적 물성/매체 서술이 일반적 미사여구보다 우수 (materials, textures, film grain, brushstrokes) | 같은 문서 | T2 |
| GPT Image의 네거티브는 산문형(`no watermark, no extra text, no logos`)이 공식 권장 — 별도 negative-prompt API 아님 | 같은 문서 | T2 |
| Imagen negative 필드는 반대로 개념 나열(`wall, frame`)이고 "no/don't" 금지 — 모델별 문법 상이 | https://cloud.google.com/vertex-ai/generative-ai/docs/image/img-gen-prompt-guide (2026-07-07) | T2 |
| 키워드 수프는 문서화된 안티패턴; 구조화된 서사(subject/style/context) 권장 | https://huggingface.co/docs/diffusers/using-diffusers/weighted_prompts | T2 |
| 긴 프롬프트 자체는 무해하나 유지보수성 문제 → 라벨 세그먼트/줄바꿈 권장 | OpenAI guide 상동 | T2 |
| 스타일 명세 공식: 매체/기법 + 사조/시대 + 표면 기법 (예: Art Deco poster, charcoal drawing) | Imagen guide 상동 | T2 |

## Wave 2 (2026-07-11) — 2 explorers

### E6 Locke — 구조화 비디오 프롬프트

| Claim | 출처 | Tier |
|---|---|---|
| Veo 공식 prompt anatomy: subject → action → scene/context → camera → lens → style → lighting → mood → temporal → audio | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/video-gen-prompt-guide (2026-07-08) | T2 |
| 오디오는 별도 문장으로 SFX/ambient/dialogue 구분; 대사는 화자+실제 발화 직접 지정 | 같은 문서 | T2 |
| Sora 2: 한 샷 = 명확한 camera move 1 + subject action 1이 가장 안정; 행동은 관찰 가능한 timed beat로("takes four steps..., pauses, ... in the final second"); 짧은 클립이 지시를 더 잘 따름 | https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide (2026-03) | T2 |
| Sora 2: 대사는 별도 `Dialogue:` 블록(화자 라벨+짧은 정확한 문장); 4초 ≈ 1-2회 짧은 교환 | 같은 문서 | T2 |
| Sora 2: 음악/SFX 정책 명시 가능(`diegetic only`, `no score` 등) | 같은 문서 | T2 |
| Sora 2: 연속성 위해 동일 캐릭터 anchor 문구를 클립마다 재사용 | 같은 문서 | T2 |
| Runway Gen-4: I2V에선 입력 이미지가 subject/composition/color/lighting을 제공하므로 텍스트는 motion(subject/scene/camera/style)에만 집중 | https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide | T2 |
| Runway: 단순 motion에서 시작해 요소를 하나씩 추가; 긍정형·직접형 문장 권장 | 같은 문서 | T2 |
| xAI 공개 문서는 API mode 중심(프롬프트 작법 가이드 빈약); duration 1-15s 파라미터, extension은 마지막 프레임 계속 | https://docs.x.ai/developers/model-capabilities/video/generation (2026-06-23) | T2 |

### E7 Boyle — 한글 텍스트 (한국어 practitioner 소스)

| Claim | 출처 | Tier |
|---|---|---|
| 전체 한국어 프롬프트는 한글이 깨졌지만, 영어 설명 + 따옴표 한글 문자열만 지정 시 정확히 생성된 실험 사례 (단일 사례, 일반 법칙 아님) | https://blog.chatdaeri.com/gpt-4o-image-generation-updated/ (2025-03-28) | T2 (practitioner) |
| 한국어 텍스트 오류는 도구 전반의 공통 한계; 불만족 시 텍스트 없는 이미지 생성 후 후편집으로 실제 한글 추가가 서비스 공식 안내 | https://docs.channel.io/carat/ko/articles/AI-이미지-생성-시-한국어가-이상하게-깨져서-나와요-d96f423e (2025-08-20) | T2 (practitioner/service) |
| 폰트 지정 효과·큰 글자 효과·성공률 수치는 검증된 반복 실험 부재 → 스킬에 보장 표현 금지 | (negative finding) | T2 부재 확인 |

## 반영 결과

R1-R11 전체 반영 완료. 매핑은 `020_reflection-map.md`, 검증 증거는
`090_closeout.md` 참조.
