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
  'meta.title': 'ima2-gen — 로컬 이미지 스튜디오 (Classic + Node 분기)',
  'meta.desc':
    '로컬에서 Classic 모드로 이미지를 만들고, 마음에 드는 결과를 Node 그래프로 분기한다. 색감·구도·카피 변종을 부모 프레임을 잃지 않고 펼친다.',
  'meta.og.title': 'ima2-gen — 마음에 든 이미지에서 가지를 친다',
  'meta.og.desc':
    'Classic + Node 그래프 분기를 갖춘 로컬 이미지 스튜디오. npx 한 줄로 띄우고, 모든 프레임은 내 컴퓨터에 남는다.',

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
  'hero.h1.line1': '마음에 든',
  'hero.h1.line2': '이미지에서',
  'hero.h1.em': '가지를 친다.',
  'hero.sub':
    '진짜로 반복하면서 시안을 만드는 사람을 위한 이미지 스튜디오. Classic으로 한 장 만들고, Node 그래프로 색감·구도·카피 변종을 펼친다. 부모 프레임은 그대로 둔 채로.',
  'hero.cta.cmd': 'npx ima2-gen serve',
  'hero.cross.lang': 'English landing →',
  'hero.shot.alt':
    'ima2-gen Classic 모드 — 프롬프트 컴포저, 생성 이미지, 모델 라벨, 결과 메타데이터가 한 화면에 보인다.',

  // Two Workflows
  'workflows.tag': '01 · 이미지 만드는 두 가지 길',
  'workflows.h.before': '두 가지 방식으로 만든다. ',
  'workflows.h.em': '분기는 한 가지 방식.',
  'workflows.lede':
    'Classic은 한 장을 빠르게. Node는 부모 프레임 하나에서 변종을 트리처럼 펼친다. 만들고 싶은 게 무엇이냐에 따라 고르면 된다.',
  'workflows.classic.label': 'Classic',
  'workflows.classic.h': '한 프롬프트, 한 장의 강한 결과.',
  'workflows.classic.body':
    '쓰고, 레퍼런스 최대 다섯 장 붙이고, 생성한다. 마음에 들 때까지 반복. 어떤 결과에서든 이어 만들 수 있다.',
  'workflows.classic.alt':
    'ima2-gen Classic 모드 — 프롬프트 컴포저, 레퍼런스, 생성된 팀 단체 이미지가 보인다.',
  'workflows.node.label': 'Node',
  'workflows.node.h': '한 프레임, 열 갈래.',
  'workflows.node.body':
    '부모를 고정한다. 자식을 펼친다 — 색감, 구도, 카피. 나란히 비교한다. 원본은 잃지 않는다.',
  'workflows.node.alt':
    'ima2-gen Node 모드 — 생성된 카드들이 연결된 그래프와 노드별 메타데이터가 보인다.',

  // Why Branch
  'branch.tag': '02 · 워크플로로서의 분기',
  'branch.h.before': '좋은 프레임은 ',
  'branch.h.em': '출발점이다.',
  'branch.lede':
    '부모를 고정하고 자식을 펼치는 것이 시각 아이디어가 실제로 전개되는 방식이다. ima2-gen은 이 방식을 기본으로 둔다.',
  'branch.shot.alt':
    'ima2-gen Node 모드 캔버스 — 부모 노드 하나와 색감·구도·카피 변종 자식 노드들.',
  'branch.scenarios.aria': '분기 시나리오 단계',
  'branch.s1.strong': '부모를 만든다.',
  'branch.s1.body': '진짜 남기고 싶은 한 장을.',
  'branch.s2.strong': '자식을 펼친다.',
  'branch.s2.body': '색감 변경, 더 타이트한 크롭, 카피 여백 변화 — 노드 셋, 런 셋.',
  'branch.s3.strong': '잃지 않고 비교한다.',
  'branch.s3.body': '부모는 그대로 남는다. 자식은 새로고침 후에도 request ID로 복구된다.',

  // Local & OAuth
  'local.tag': '03 · 로컬 & 오픈',
  'local.h.before': '로그인은 한 번. ',
  'local.h.em': '저장은 내 디스크.',
  'local.lede':
    'ima2-gen은 이미 깔려 있는 Codex/ChatGPT 로그인을 그대로 쓴다. 생성된 프레임과 세션은 다른 사람의 서버가 아니라 내 디스크에 남는다.',
  'local.quote.before': '설정 화면에 ',
  'local.quote.strong': 'Configured but disabled',
  'local.quote.after':
    '라고 떠 있으면, env/config에 API key가 있긴 하지만 이미지 생성은 여전히 OAuth로 동작한다는 뜻이다.',
  'local.meta': '유저 데이터 폴더 · MIT 라이선스 · 살펴보고, 동기화하고, 버전 관리하고 — 사용자 마음대로.',
  'local.shot.alt':
    'ima2-gen 설정 화면 — OAuth 활성, API key는 설정되어 있지만 비활성.',

  // Style & References
  'style.tag': '04 · 비주얼 메모리',
  'style.h.before': '룩을 잡는다. ',
  'style.h.em': '어디서나 다시 쓴다.',
  'style.lede':
    '스타일 시트에 medium, composition, mood, palette, negative를 고정한다. 레퍼런스는 다섯 장까지 붙고, 세션이 바뀌어도 살아남는다.',
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
  'install.h.before': '명령어 한 줄. ',
  'install.h.em': '그 뒤는 반복.',
  'install.lede': 'npx로 띄운다. Codex로 한 번 로그인한다. 가지를 치기 시작한다.',
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
  'faq.q1': 'Node 모드는 정확히 뭘 하는 건가요?',
  'faq.a1':
    '좋은 프레임 하나를 부모로 두고, 자식 노드로 변종을 펼치게 해 줍니다 — 다른 프롬프트, 다른 구도, 다른 색감. 원본은 그대로 남습니다. 새로고침 후에도 자식은 request ID로 복구됩니다.',
  'faq.q2': '내 이미지는 어디 저장되나요?',
  'faq.a2':
    '로컬에 저장됩니다. 생성된 프레임과 세션 메타데이터는 사용자 데이터 폴더에 남습니다. 살펴보고, 동기화하고, 버전 관리하는 건 사용자 마음대로입니다. 외부 서비스로 업로드되지 않습니다.',
  'faq.q3': 'OpenAI API key가 필요한가요?',
  'faq.a3':
    '이미지 생성에는 필요 없습니다. ima2-gen은 로컬의 Codex/ChatGPT OAuth 세션을 그대로 씁니다. 보조 경로에서 API key가 감지될 수는 있지만, 생성 자체는 OAuth-only로 동작합니다.',

  // Footer
  'footer.line1': 'ima2-gen · MIT 라이선스',
  'footer.line2': '마음에 든 이미지에서 가지를 친다.',
  'footer.line3': '로컬에서 만든다. 공개 저장소에 기록한다.',
  'footer.lang.aria': '언어별 README',

  // LangToggle
  'lang.aria': '언어',
};

export const STRINGS: Record<Lang, Dict> = { en, ko };

export function t(lang: Lang, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
