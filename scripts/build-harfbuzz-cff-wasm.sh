#!/usr/bin/env sh
set -eu

# Rebuilds the browser-only CFF/CFF2-capable HarfBuzz subsetter from the
# official 14.2.0 source release. The output ABI matches font.worker.ts.
HARFBUZZ_TAG="14.2.0"
HARFBUZZ_COMMIT="b0ffab42d473eb380ad0fcf42730e0f1868cbc97"
EMSDK_IMAGE="emscripten/emsdk@sha256:af45409f3199d88db4b1b03af0098532c8fb33a375ac257463eeb0a622870d06"
OUTPUT_NAME="harfbuzz-subset-cff-14.2.0.wasm"

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
build_dir=$(mktemp -d)
cleanup() {
  rm -rf "$build_dir"
}
trap cleanup EXIT INT TERM

git clone --depth 1 --branch "$HARFBUZZ_TAG" https://github.com/harfbuzz/harfbuzz.git "$build_dir/harfbuzz"
actual_commit=$(git -C "$build_dir/harfbuzz" rev-parse HEAD)
if [ "$actual_commit" != "$HARFBUZZ_COMMIT" ]; then
  printf '%s\n' "Expected HarfBuzz $HARFBUZZ_COMMIT, got $actual_commit" >&2
  exit 1
fi

mkdir -p "$build_dir/out" "$project_root/static/wasm"
docker run --rm --platform linux/amd64 \
  -v "$build_dir/harfbuzz:/src:ro" \
  -v "$build_dir/out:/out" \
  "$EMSDK_IMAGE" \
  em++ /src/src/harfbuzz-subset.cc -I/src/src -O3 --no-entry \
  -s STANDALONE_WASM=1 \
  -s ENVIRONMENT=web,worker \
  -s FILESYSTEM=0 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=67108864 \
  -s MAXIMUM_MEMORY=536870912 \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_hb_blob_create","_hb_blob_destroy","_hb_blob_get_data","_hb_blob_get_length","_hb_face_create","_hb_face_destroy","_hb_face_reference_blob","_hb_set_add","_hb_subset_input_create_or_fail","_hb_subset_input_destroy","_hb_subset_input_set_flags","_hb_subset_input_unicode_set","_hb_subset_or_fail"]' \
  -o "/out/$OUTPUT_NAME"

install -m 0644 "$build_dir/out/$OUTPUT_NAME" "$project_root/static/wasm/$OUTPUT_NAME"
shasum -a 256 "$project_root/static/wasm/$OUTPUT_NAME"
