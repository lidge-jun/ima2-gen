#!/usr/bin/env bash
# ima2-gen 원클릭 설치 (macOS)
#
# 사용:
#   curl -fsSL https://lidge-jun.github.io/ima2-gen/install-mac.sh | bash
#   또는
#   bash install-mac.sh
#
# 동작 순서:
#   1. Node.js 설치 여부 확인 (없으면 Homebrew로 설치, Brew 없으면 안내)
#   2. ima2-gen 전역 설치 (npm install -g ima2-gen)
#   3. ima2 serve 실행 (포트 3333)

set -euo pipefail

print() { printf '\033[1;36m▸\033[0m %s\n' "$1"; }
warn()  { printf '\033[1;33m⚠\033[0m %s\n' "$1"; }
fail()  { printf '\033[1;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

# 1. Node.js 확인
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node --version)"
  print "Node.js 감지됨: $NODE_VERSION"
else
  warn "Node.js가 설치되어 있지 않습니다."
  if command -v brew >/dev/null 2>&1; then
    print "Homebrew로 Node.js LTS를 설치합니다…"
    brew install node
  else
    fail "Homebrew가 없습니다. https://brew.sh 에서 먼저 설치하시거나, https://nodejs.org 에서 Node.js를 직접 받아 주세요."
  fi
fi

# 2. ima2-gen 설치
print "ima2-gen을 전역으로 설치합니다…"
if npm install -g ima2-gen; then
  print "ima2-gen 설치 완료"
else
  fail "ima2-gen 설치에 실패했습니다. npm 권한 문제라면 'sudo'로 다시 실행하거나, npm prefix를 사용자 폴더로 바꿔 주세요."
fi

# 3. 실행
print "이미지 스튜디오를 띄웁니다 (Ctrl+C로 종료)…"
print "브라우저가 자동으로 열리지 않으면 http://localhost:3333 으로 접속하세요."
echo
exec ima2 serve
