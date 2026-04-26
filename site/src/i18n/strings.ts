export type Lang = 'en' | 'ko';

type Dict = Record<string, string>;

const en: Dict = {
  // Base / meta
  'meta.title': 'ima2-gen — Local Image Studio with Classic + Node Branching',
  'meta.desc':
    'Generate images locally with Classic mode, then branch the ones you love in a Node graph — palette, framing, and copy variants without losing the parent.',
  'meta.og.title': 'ima2-gen — Branch the images you love',
  'meta.og.desc':
    'A local image studio with Classic + Node-graph branching. Run it with npx, keep every frame on your machine.',

  // Header
  'header.brand.aria': 'ima2-gen home',
  'header.nav.aria': 'Section navigation',
  'header.nav.workflows': 'Workflows',
  'header.nav.branch': 'Branch',
  'header.nav.local': 'Local',
  'header.nav.install': 'Install',
  'header.gh': 'GitHub ↗',

  // Hero
  'hero.eyebrow': 'Local image studio · Classic + Node',
  'hero.h1.line1': 'Branch the',
  'hero.h1.line2': 'images you',
  'hero.h1.em': 'love.',
  'hero.sub':
    "An image studio for the way you actually iterate. Generate in Classic, fan out variations in a Node graph — palette, framing, copy — without losing the parent frame.",
  'hero.cta.cmd': 'npx ima2-gen serve',
  'hero.cross.lang': '한국어 README →',
  'hero.shot.alt':
    'ima2-gen Classic mode showing the prompt composer, generated image, model label, and result metadata.',

  // Two Workflows
  'workflows.tag': '01 · Two ways to make',
  'workflows.h.before': 'Two ways to make. ',
  'workflows.h.em': 'One way to branch.',
  'workflows.lede':
    "Classic for one strong frame. Node for a tree of variations from a parent you locked in. Pick the workflow your idea wants.",
  'workflows.classic.label': 'Classic',
  'workflows.classic.h': 'One prompt, one strong frame.',
  'workflows.classic.body':
    'Write, attach up to five references, generate. Iterate until it lands. Continue from any result.',
  'workflows.classic.alt':
    'ima2-gen Classic mode with prompt composer, references, and a generated team portrait.',
  'workflows.node.label': 'Node',
  'workflows.node.h': 'One frame, ten directions.',
  'workflows.node.body':
    'Lock a parent. Fan out children — palette, framing, copy. Compare side by side. Never lose the original.',
  'workflows.node.alt':
    'ima2-gen Node mode with connected generated cards and per-node metadata.',

  // Why Branch
  'branch.tag': '02 · Branching as a workflow',
  'branch.h.before': 'A good frame is a ',
  'branch.h.em': 'starting point.',
  'branch.lede':
    'Locking the parent and fanning out children is how visual ideas actually develop. ima2-gen makes it the default.',
  'branch.shot.alt':
    'ima2-gen Node mode canvas with a parent node and child branches showing palette, framing, and copy variants.',
  'branch.scenarios.aria': 'Branching scenario steps',
  'branch.s1.strong': 'Generate a parent.',
  'branch.s1.body': 'A frame you actually want to keep.',
  'branch.s2.strong': 'Fan out children.',
  'branch.s2.body': 'Palette swap, tighter crop, alternate copy margin — three nodes, three runs.',
  'branch.s3.strong': 'Compare without loss.',
  'branch.s3.body': 'The parent stays. Children recover by request ID even after a refresh.',

  // Local & OAuth
  'local.tag': '03 · Local & open',
  'local.h.before': 'Sign in. ',
  'local.h.em': 'Stay local.',
  'local.lede':
    "ima2-gen reuses your existing Codex/ChatGPT login. Generated frames and sessions live on your disk — not on someone else's.",
  'local.quote.before': 'If the settings page says ',
  'local.quote.strong': 'Configured but disabled',
  'local.quote.after': ', that means an API key exists in env/config but image generation still uses OAuth.',
  'local.meta': 'User-data folder · MIT licensed · Inspect, sync, version — your call.',
  'local.shot.alt':
    'ima2-gen Settings workspace showing OAuth active and an API key configured but disabled.',

  // Style & References
  'style.tag': '04 · Visual memory',
  'style.h.before': 'Capture the look. ',
  'style.h.em': 'Reuse it everywhere.',
  'style.lede':
    'Style sheets pin medium, composition, mood, palette, and negatives. References attach up to five inputs and persist across sessions.',
  'style.shot.alt':
    'ima2-gen Style sheet editor with medium, composition, mood, subject, palette, and negative fields.',
  'style.field.medium': 'medium',
  'style.field.composition': 'composition',
  'style.field.mood': 'mood',
  'style.field.subject': 'subject',
  'style.field.palette': 'palette',
  'style.field.negative': 'negative',

  // Install
  'install.tag': '05 · Get going',
  'install.h.before': 'One command. ',
  'install.h.em': 'Then iterate.',
  'install.lede': 'Run it with npx. Sign in once with Codex. Start branching.',
  'install.badge.npm': 'npm v1.1.0',
  'install.badge.node': 'Node ≥20',
  'install.badge.mit': 'MIT',
  'install.links.aria': 'Project links',
  'install.link.repo': 'GitHub repository',
  'install.link.npm': 'npm package',
  'install.link.ko': '한국어 README',
  'install.link.ja': '日本語 README',
  'install.link.zh': '简体中文 README',

  // FAQ
  'faq.tag': 'FAQ',
  'faq.q1': 'What does Node mode actually do?',
  'faq.a1':
    'It treats one good frame as a parent and lets you fan out children — different prompts, different framing, different palettes — without losing the original. Children even recover by request ID after a page refresh.',
  'faq.q2': 'Where do my images live?',
  'faq.a2':
    'Locally. Generated frames and session metadata live in a user-data folder on your disk. Inspect, sync, version — your call. Nothing uploaded to a remote service.',
  'faq.q3': 'Do I need an OpenAI API key?',
  'faq.a3':
    'Not for image generation. ima2-gen reuses your local Codex/ChatGPT OAuth session. A key may still be detected for auxiliary paths, but generation itself is OAuth-only.',

  // Footer
  'footer.line1': 'ima2-gen · MIT licensed',
  'footer.line2': 'Branch the images you love.',
  'footer.line3': 'Built local. Documented in the open.',
  'footer.lang.aria': 'Language READMEs',

  // LangToggle
  'lang.aria': 'Language',
};

const ko: Dict = {
  // Base / meta
  'meta.title': 'ima2-gen — 로컬 이미지 스튜디오, Classic + Node 분기',
  'meta.desc':
    'Classic으로 한 장 잡고, Node 그래프에서 색감·구도·카피 변형을 펼치는 로컬 이미지 스튜디오.',
  'meta.og.title': 'ima2-gen — 맘에 드는 한 컷, 거기서 가지치기',
  'meta.og.desc':
    'Classic + Node 분기 워크플로의 로컬 이미지 스튜디오. npx 한 줄로 띄우고, 모든 컷은 내 컴퓨터에.',

  // Header
  'header.brand.aria': 'ima2-gen 홈',
  'header.nav.aria': '섹션 내비게이션',
  'header.nav.workflows': '워크플로',
  'header.nav.branch': '분기',
  'header.nav.local': '로컬',
  'header.nav.install': '설치',
  'header.gh': 'GitHub ↗',

  // Hero
  'hero.eyebrow': '로컬 이미지 스튜디오 · Classic + Node',
  'hero.h1.line1': '맘에 드는 한 컷,',
  'hero.h1.line2': '거기서',
  'hero.h1.em': '가지치기.',
  'hero.sub':
    '한 장 만들고 끝낼 작업이 아니라면. Classic으로 빠르게 한 장, Node 그래프로 색감·구도·카피 변형. 원본은 그대로.',
  'hero.cta.cmd': 'npx ima2-gen serve',
  'hero.cross.lang': 'English landing →',
  'hero.shot.alt':
    'ima2-gen Classic 모드 — 프롬프트 컴포저, 생성 이미지, 모델 라벨, 결과 메타가 한 화면에.',

  // Two Workflows
  'workflows.tag': '01 · 만드는 두 가지 방식',
  'workflows.h.before': '만드는 길은 둘. ',
  'workflows.h.em': '가지치는 길은 하나.',
  'workflows.lede':
    'Classic은 한 장을 빠르게. Node는 맘에 든 부모에서 변종을 트리처럼. 그날 필요한 워크플로로 골라 쓰면 된다.',
  'workflows.classic.label': 'Classic',
  'workflows.classic.h': '한 장으로 끝내고 싶을 때.',
  'workflows.classic.body':
    '프롬프트 쓰고, 레퍼런스 다섯 장까지 붙이고, 생성. 만족할 때까지 반복하고, 어떤 결과에서든 이어 만들 수 있다.',
  'workflows.classic.alt':
    'ima2-gen Classic 모드 — 프롬프트 컴포저, 레퍼런스, 생성된 인물 컷.',
  'workflows.node.label': 'Node',
  'workflows.node.h': '한 컷에서 열 갈래.',
  'workflows.node.body':
    '부모 고정. 자식으로 색감·구도·카피 펼치기. 옆에 두고 비교. 원본은 안 잃는다.',
  'workflows.node.alt':
    'ima2-gen Node 모드 — 연결된 카드들과 노드별 메타.',

  // Why Branch
  'branch.tag': '02 · 분기, 그게 워크플로',
  'branch.h.before': '좋은 한 장은 끝이 아니라 ',
  'branch.h.em': '시작.',
  'branch.lede':
    '부모를 잠그고 자식을 펼치는 게, 시각 아이디어가 실제로 자라는 방식. 그래서 ima2-gen은 이걸 기본 동작으로 박아 뒀다.',
  'branch.shot.alt':
    'ima2-gen Node 모드 — 부모 노드 한 장과 색감·구도·카피 변종 자식 노드들.',
  'branch.scenarios.aria': '분기 시나리오 단계',
  'branch.s1.strong': '먼저 부모 한 장.',
  'branch.s1.body': '남기고 싶을 만큼 잘 나온 컷으로.',
  'branch.s2.strong': '거기서 자식 펼치기.',
  'branch.s2.body': '색감만 살짝, 크롭만 더 타이트, 카피 여백만 다르게 — 노드 셋이면 런 셋.',
  'branch.s3.strong': '잃지 않고 나란히.',
  'branch.s3.body': '부모는 그대로. 자식은 새로고침해도 request ID로 살아 돌아온다.',

  // Local & OAuth
  'local.tag': '03 · 로컬 & 오픈',
  'local.h.before': '로그인 한 번, ',
  'local.h.em': '저장은 내 디스크.',
  'local.lede':
    '이미 쓰고 있는 Codex/ChatGPT 로그인을 그대로 활용. 만든 컷과 세션은 누군가의 서버가 아니라 내 디스크에 남는다.',
  'local.quote.before': '설정에 ',
  'local.quote.strong': 'Configured but disabled',
  'local.quote.after':
    '가 떠 있다면, env/config에 key가 있어도 이미지 생성은 OAuth로만 돌아간다는 뜻.',
  'local.meta': '사용자 데이터 폴더 · MIT · 들여다보고, 동기화하고, 버전 관리도 마음대로.',
  'local.shot.alt':
    'ima2-gen 설정 화면 — OAuth 활성, API key는 설정되어 있지만 비활성.',

  // Style & References
  'style.tag': '04 · 비주얼 메모리',
  'style.h.before': '한 번 잡은 룩, ',
  'style.h.em': '어디서나 다시.',
  'style.lede':
    '스타일 시트에 medium·composition·mood·palette·negative를 박아 두면 끝. 레퍼런스도 다섯 장까지, 세션 너머로 살아남는다.',
  'style.shot.alt':
    'ima2-gen 스타일 시트 에디터 — medium, composition, mood, subject, palette, negative 필드.',
  'style.field.medium': 'medium',
  'style.field.composition': 'composition',
  'style.field.mood': 'mood',
  'style.field.subject': 'subject',
  'style.field.palette': 'palette',
  'style.field.negative': 'negative',

  // Install
  'install.tag': '05 · 시작하기',
  'install.h.before': '명령어 한 줄, ',
  'install.h.em': '그다음은 반복.',
  'install.lede': 'npx로 띄우고, Codex로 한 번 로그인하고, 가지치기 시작.',
  'install.badge.npm': 'npm v1.1.0',
  'install.badge.node': 'Node ≥20',
  'install.badge.mit': 'MIT',
  'install.links.aria': '프로젝트 링크',
  'install.link.repo': 'GitHub 저장소',
  'install.link.npm': 'npm 패키지',
  'install.link.ko': '한국어 README',
  'install.link.ja': '日本語 README',
  'install.link.zh': '简体中文 README',

  // FAQ
  'faq.tag': 'FAQ',
  'faq.q1': 'Node 모드는 뭘 하는 건가요?',
  'faq.a1':
    '좋은 한 장을 부모로 두고, 자식 노드로 변형을 펼치는 작업면이에요. 다른 프롬프트, 다른 구도, 다른 색감을 한 화면에서 비교하고, 원본은 그대로 남깁니다. 새로고침해도 request ID로 자식이 살아 돌아옵니다.',
  'faq.q2': '이미지는 어디 저장돼요?',
  'faq.a2':
    '전부 로컬. 사용자 데이터 폴더에 컷과 세션 메타가 남아요. 들여다보고, 동기화하고, 버전 관리하는 건 본인 자유. 외부 서비스로는 아무것도 안 올라갑니다.',
  'faq.q3': 'OpenAI API key가 필요한가요?',
  'faq.a3':
    '이미지 생성에는 필요 없어요. 로컬의 Codex/ChatGPT OAuth를 그대로 씁니다. 환경에 key가 잡혀 있다면 보조 기능에서만 쓰일 수 있고, 생성 자체는 OAuth-only로 돌아갑니다.',

  // Footer
  'footer.line1': 'ima2-gen · MIT 라이선스',
  'footer.line2': '맘에 드는 한 컷, 거기서 가지치기.',
  'footer.line3': '로컬에서, 공개로.',
  'footer.lang.aria': '언어별 README',

  // LangToggle
  'lang.aria': '언어',
};

export const STRINGS: Record<Lang, Dict> = { en, ko };

export function t(lang: Lang, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
