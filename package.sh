#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -u

_main() {
  pushd ext
  zip ../standardized-screenshot.zip  . -r -x .DS_Store
  popd
}

_main "$@"
