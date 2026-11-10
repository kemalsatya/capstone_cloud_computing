#!/usr/bin/env bash
# Prepare a reviewed desired-state change after an image is actually published.
# Does not commit, push, merge, deploy, or create a pull request.
set -euo pipefail

image_tag="${1:?Usage: prepare-image-update.sh <7-character-source-sha>}"
if [[ ! "$image_tag" =~ ^[0-9a-f]{7}$ ]]; then
  echo "Expected a seven-character hexadecimal source SHA." >&2
  exit 1
fi

project_root="$(git rev-parse --show-toplevel)"
manifest_file="$project_root/deployment/kustomization.yaml"
test -f "$manifest_file"

# The classroom registry is HTTP and reachable by the local Gitea runner host.
curl --fail --silent --show-error --head \
  --header 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json' \
  "http://localhost:5001/v2/journalfit-backend/manifests/$image_tag" >/dev/null

tag_count="$(sed -n '/^[[:space:]]*newTag:/p' "$manifest_file" | wc -l)"
if [[ "$tag_count" -ne 1 ]]; then
  echo "Expected exactly one image tag in deployment/kustomization.yaml." >&2
  exit 1
fi
sed -i -E "s/^([[:space:]]*newTag:).*/\1 $image_tag/" "$manifest_file"
git -C "$project_root" diff --check -- deployment/kustomization.yaml
git -C "$project_root" diff -- deployment/kustomization.yaml
echo "Desired-state change prepared. Review through a feature branch and PR; no direct commit to main."
