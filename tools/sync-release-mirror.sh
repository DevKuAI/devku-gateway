#!/bin/sh
# Synchronize Gateway release archives from GitHub to a static web root.

set -eu

REPOSITORY="DevKuAI/devku-gateway"

output_dir=""
public_base_url=""
tag=""
stage_root=""
lock_dir=""

say() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage:
  sync-release-mirror.sh \
    --output-dir /var/www/devku-gateway \
    --public-base-url https://download.example.com/devku-gateway \
    [--version v0.1.78]

The script downloads and verifies all release archives, publishes them under
releases/<version>, updates releases/latest.txt, and renders mirror-backed
install.sh and install.ps1 files into the output directory.
EOF
}

cleanup() {
    if [ -n "$stage_root" ] && [ -d "$stage_root" ]; then
        rm -rf "$stage_root"
    fi
    if [ -n "$lock_dir" ] && [ -d "$lock_dir" ]; then
        rmdir "$lock_dir" 2>/dev/null || true
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

while [ "$#" -gt 0 ]; do
    case "$1" in
        --output-dir)
            [ "$#" -ge 2 ] || fail "--output-dir requires a value"
            output_dir=$2
            shift 2
            ;;
        --public-base-url)
            [ "$#" -ge 2 ] || fail "--public-base-url requires a value"
            public_base_url=$2
            shift 2
            ;;
        --version)
            [ "$#" -ge 2 ] || fail "--version requires a value"
            tag=$2
            shift 2
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            fail "unknown option: $1"
            ;;
    esac
done

[ -n "$output_dir" ] || fail "--output-dir is required"
[ -n "$public_base_url" ] || fail "--public-base-url is required"
case "$output_dir" in
    /*) ;;
    *) fail "--output-dir must be an absolute path" ;;
esac
case "$output_dir" in
    */../* | */..) fail "--output-dir cannot contain .. path segments" ;;
esac
case "$public_base_url" in
    http://* | https://*) ;;
    *) fail "--public-base-url must start with http:// or https://" ;;
esac
case "$public_base_url" in
    *[!A-Za-z0-9:/._~-]*) fail "--public-base-url contains unsupported characters" ;;
esac
public_base_url=${public_base_url%/}

for command_name in curl awk grep mktemp sed cmp; do
    command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done

if [ -z "$tag" ]; then
    location=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPOSITORY/releases/latest") ||
        fail "could not resolve the latest GitHub release"
    tag=${location##*/}
fi
case "$tag" in
    *[!A-Za-z0-9._-]* | "") fail "unexpected release tag: $tag" ;;
esac
case "$tag" in
    v[0-9]*.[0-9]*.[0-9]*) ;;
    *) fail "unexpected release tag: $tag" ;;
esac
version=${tag#v}

mkdir -p "$output_dir" || fail "cannot create $output_dir"
output_dir=$(CDPATH='' cd -- "$output_dir" && pwd -P) || fail "cannot resolve $output_dir"
[ "$output_dir" != "/" ] || fail "--output-dir cannot resolve to the filesystem root"
mkdir -p "$output_dir/releases" || fail "cannot create $output_dir/releases"
lock_dir="$output_dir/.gateway-release-sync.lock"
mkdir "$lock_dir" 2>/dev/null || fail "another mirror synchronization is already running"

stage_root=$(mktemp -d "$output_dir/.gateway-release-sync.XXXXXX")
stage_release="$stage_root/$tag"
mkdir -p "$stage_release"

github_base_url="https://github.com/$REPOSITORY/releases/download/$tag"
say "Downloading Gateway $tag from GitHub..."
curl -fsSL -o "$stage_release/checksums.txt" "$github_base_url/checksums.txt" ||
    fail "download failed: $github_base_url/checksums.txt"

archives="
gateway_${version}_darwin_amd64.tar.gz
gateway_${version}_darwin_arm64.tar.gz
gateway_${version}_linux_amd64.tar.gz
gateway_${version}_linux_arm64.tar.gz
gateway_${version}_windows_amd64.zip
gateway_${version}_windows_arm64.zip
"

verify_checksum() {
    file_path=$1
    expected_hash=$2
    if command -v sha256sum >/dev/null 2>&1; then
        actual_hash=$(sha256sum "$file_path" | awk '{ print $1 }')
    elif command -v shasum >/dev/null 2>&1; then
        actual_hash=$(shasum -a 256 "$file_path" | awk '{ print $1 }')
    else
        fail "sha256sum or shasum is required to verify release archives"
    fi
    [ "$actual_hash" = "$expected_hash" ] || fail "checksum mismatch for $(basename "$file_path")"
}

target_release="$output_dir/releases/$tag"
if [ -d "$target_release" ]; then
    cmp -s "$stage_release/checksums.txt" "$target_release/checksums.txt" ||
        fail "$target_release already exists with different checksums"
    for archive in $archives; do
        expected=$(awk -v f="$archive" '$2 == f { print $1 }' "$stage_release/checksums.txt")
        [ -f "$target_release/$archive" ] || fail "$target_release is incomplete: missing $archive"
        verify_checksum "$target_release/$archive" "$expected"
    done
    say "Release $tag is already synchronized and verified."
else
    for archive in $archives; do
        expected=$(awk -v f="$archive" '$2 == f { print $1 }' "$stage_release/checksums.txt")
        [ -n "$expected" ] || fail "no checksum for $archive in checksums.txt"
        printf '%s\n' "$expected" | grep -Eq '^[0-9a-fA-F]{64}$' || fail "invalid checksum for $archive"
        curl -fsSL -o "$stage_release/$archive" "$github_base_url/$archive" ||
            fail "download failed: $github_base_url/$archive"
        verify_checksum "$stage_release/$archive" "$expected"
        say "Verified $archive"
    done
    mv "$stage_release" "$target_release"
    say "Published release files to $target_release"
fi

render_shell_installer() {
    target_file=$1
    target_tmp="$target_file.tmp.$$"
    sed "s|__GATEWAY_MIRROR_URL__|$public_base_url|g" > "$target_tmp" <<'INSTALL_SH_EOF'
#!/bin/sh
# Generated by sync-release-mirror.sh for macOS and Linux.

set -eu

BINARY="gateway"
MIRROR_URL="${GATEWAY_MIRROR_URL:-__GATEWAY_MIRROR_URL__}"

say() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"

case "$MIRROR_URL" in
    http://* | https://*) ;;
    *) fail "mirror URL must start with http:// or https://" ;;
esac
MIRROR_URL=${MIRROR_URL%/}

case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *) fail "unsupported OS: $(uname -s) (Windows: use install.ps1)" ;;
esac

case "$(uname -m)" in
    x86_64 | amd64) arch="amd64" ;;
    arm64 | aarch64) arch="arm64" ;;
    *) fail "unsupported architecture: $(uname -m)" ;;
esac

tag="${GOMODEL_VERSION:-}"
if [ -z "$tag" ]; then
    tag=$(curl -fsSL "$MIRROR_URL/releases/latest.txt") ||
        fail "could not resolve the latest release from $MIRROR_URL/releases/latest.txt"
    tag=$(printf '%s' "$tag" | tr -d '[:space:]')
fi
case "$tag" in
    *[!A-Za-z0-9._-]* | "") fail "unexpected release tag: $tag" ;;
esac
case "$tag" in
    v[0-9]*.[0-9]*.[0-9]*) ;;
    *) fail "unexpected release tag: $tag" ;;
esac
version=${tag#v}

archive="${BINARY}_${version}_${os}_${arch}.tar.gz"
base_url="$MIRROR_URL/releases/$tag"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT INT TERM

say "Downloading $BINARY $tag ($os/$arch) from the release mirror..."
curl -fsSL -o "$tmpdir/$archive" "$base_url/$archive" || fail "download failed: $base_url/$archive"
curl -fsSL -o "$tmpdir/checksums.txt" "$base_url/checksums.txt" || fail "download failed: $base_url/checksums.txt"

expected=$(awk -v f="$archive" '$2 == f { print $1 }' "$tmpdir/checksums.txt")
[ -n "$expected" ] || fail "no checksum for $archive in checksums.txt"
if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$tmpdir/$archive" | awk '{ print $1 }')
elif command -v shasum >/dev/null 2>&1; then
    actual=$(shasum -a 256 "$tmpdir/$archive" | awk '{ print $1 }')
else
    fail "sha256sum or shasum is required to verify the download"
fi
[ "$actual" = "$expected" ] || fail "checksum mismatch for $archive"
say "Checksum verified."

tar -xzf "$tmpdir/$archive" -C "$tmpdir" "$BINARY"

install_dir="${GOMODEL_INSTALL_DIR:-}"
if [ -z "$install_dir" ]; then
    if [ -w /usr/local/bin ]; then
        install_dir="/usr/local/bin"
    else
        install_dir="$HOME/.local/bin"
    fi
fi
mkdir -p "$install_dir" || fail "cannot create $install_dir"
[ -w "$install_dir" ] || fail "$install_dir is not writable - set GOMODEL_INSTALL_DIR to a writable directory, or rerun with sudo"
install -m 755 "$tmpdir/$BINARY" "$install_dir/$BINARY"

say ""
say "Installed $BINARY $tag to $install_dir/$BINARY"
case ":$PATH:" in
    *":$install_dir:"*) ;;
    *)
        say ""
        say "Note: $install_dir is not on your PATH. Add it with:"
        say "  export PATH=\"$install_dir:\$PATH\""
        ;;
esac
say ""
say "Get started:"
say "  export OPENAI_API_KEY=sk-...   # or any other provider key"
say "  $BINARY"
say ""
say "Release mirror: $MIRROR_URL"
INSTALL_SH_EOF
    chmod 0755 "$target_tmp"
    mv "$target_tmp" "$target_file"
}

render_powershell_installer() {
    target_file=$1
    target_tmp="$target_file.tmp.$$"
    sed "s|__GATEWAY_MIRROR_URL__|$public_base_url|g" > "$target_tmp" <<'INSTALL_PS1_EOF'
# Generated by sync-release-mirror.sh for Windows.

$ErrorActionPreference = 'Stop'

$Binary = 'gateway'
$MirrorUrl = if ($env:GATEWAY_MIRROR_URL) { $env:GATEWAY_MIRROR_URL } else { '__GATEWAY_MIRROR_URL__' }

$parsedMirrorUrl = $null
if (-not [Uri]::TryCreate($MirrorUrl, [UriKind]::Absolute, [ref]$parsedMirrorUrl) -or
    $parsedMirrorUrl.Scheme -notin @('http', 'https')) {
    throw 'mirror URL must start with http:// or https://'
}
$MirrorUrl = $MirrorUrl.TrimEnd('/')

# PROCESSOR_ARCHITEW6432 reports the real machine architecture when running
# in a 32-bit PowerShell on a 64-bit Windows.
$rawArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
$arch = switch ($rawArch) {
    'AMD64' { 'amd64' }
    'ARM64' { 'arm64' }
    default { throw "unsupported architecture: $rawArch" }
}

$tag = $env:GOMODEL_VERSION
if (-not $tag) {
    $tag = (Invoke-RestMethod -Uri "$MirrorUrl/releases/latest.txt").ToString().Trim()
}
if ($tag -notmatch '^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') {
    throw "unexpected release tag: $tag"
}
$version = $tag.TrimStart('v')

$archive = "${Binary}_${version}_windows_${arch}.zip"
$baseUrl = "$MirrorUrl/releases/$tag"

$tmpDir = Join-Path ([IO.Path]::GetTempPath()) "gateway-install-$([IO.Path]::GetRandomFileName())"
New-Item -ItemType Directory -Path $tmpDir | Out-Null
try {
    Write-Host "Downloading $Binary $tag (windows/$arch) from the release mirror..."
    Invoke-WebRequest -Uri "$baseUrl/$archive" -OutFile (Join-Path $tmpDir $archive)
    Invoke-WebRequest -Uri "$baseUrl/checksums.txt" -OutFile (Join-Path $tmpDir 'checksums.txt')

    $expected = $null
    foreach ($line in Get-Content (Join-Path $tmpDir 'checksums.txt')) {
        $parts = $line.Trim() -split '\s+'
        if ($parts.Length -ge 2 -and $parts[1] -eq $archive) {
            $expected = $parts[0]
            break
        }
    }
    if (-not $expected) { throw "no checksum for $archive in checksums.txt" }
    $actual = (Get-FileHash (Join-Path $tmpDir $archive) -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected.ToLower()) { throw "checksum mismatch for $archive" }
    Write-Host 'Checksum verified.'

    Expand-Archive -Path (Join-Path $tmpDir $archive) -DestinationPath $tmpDir -Force

    $installDir = $env:GOMODEL_INSTALL_DIR
    if (-not $installDir) { $installDir = Join-Path $env:LOCALAPPDATA 'Programs\gateway' }
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    Copy-Item (Join-Path $tmpDir "$Binary.exe") (Join-Path $installDir "$Binary.exe") -Force

    Write-Host ''
    Write-Host "Installed $Binary $tag to $installDir\$Binary.exe"

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (($userPath -split ';') -notcontains $installDir) {
        $newPath = if ([string]::IsNullOrEmpty($userPath)) { $installDir } else { "$userPath;$installDir" }
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Write-Host "Added $installDir to your user PATH - restart your terminal to pick it up."
    }

    Write-Host ''
    Write-Host 'Get started:'
    Write-Host '  $env:OPENAI_API_KEY = "sk-..."   # or any other provider key'
    Write-Host "  $Binary"
    Write-Host ''
    Write-Host "Release mirror: $MirrorUrl"
}
finally {
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
INSTALL_PS1_EOF
    chmod 0644 "$target_tmp"
    mv "$target_tmp" "$target_file"
}

render_shell_installer "$output_dir/install.sh"
render_powershell_installer "$output_dir/install.ps1"

latest_tmp="$output_dir/releases/.latest.txt.$$"
printf '%s\n' "$tag" > "$latest_tmp"
mv "$latest_tmp" "$output_dir/releases/latest.txt"

say ""
say "Release mirror synchronized successfully."
say "Version: $tag"
say "macOS/Linux installer: $public_base_url/install.sh"
say "Windows installer: $public_base_url/install.ps1"
