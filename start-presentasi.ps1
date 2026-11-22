[CmdletBinding()]
param(
    [switch]$BukaBrowser,
    [switch]$UploadFixture
)

# Native Docker commands report progress on stderr. Validate their exit codes.
$ErrorActionPreference = 'Continue'
$composeFile = Join-Path $PSScriptRoot 'compose.yaml'
$url = 'http://journalfit.localhost:8088/'
$api = 'http://127.0.0.1:8088'
$fixture = Join-Path $PSScriptRoot 'evidence/platform/tahap-5/run-20261118t124752z-08162c/fixtures/compliant.docx'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI belum tersedia. Buka Docker Desktop dan periksa PATH.'
}
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "File Compose tidak ditemukan: $composeFile"
}
foreach ($tool in @('kubectl', 'curl.exe')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Tool presentasi belum tersedia: $tool"
    }
}
if ($UploadFixture -and -not (Test-Path -LiteralPath $fixture -PathType Leaf)) {
    throw "Fixture DOCX tidak tersedia: $fixture"
}

function Get-JournalFitResponse {
    param([string]$RequestUrl, [int]$ExpectedStatus, [string[]]$RequestOptions)

    $lines = @(& curl.exe --silent --show-error --noproxy '*' --max-time 20 `
        -H 'Host: journalfit.localhost' --write-out '\n%{http_code}' @RequestOptions $RequestUrl)
    if ($LASTEXITCODE -ne 0 -or $lines.Count -lt 2) {
        throw "Request gagal: $RequestUrl"
    }
    if ($lines[-1] -ne "$ExpectedStatus") {
        throw "$RequestUrl memberi HTTP $($lines[-1]), diharapkan $ExpectedStatus."
    }
    ($lines[0..($lines.Count - 2)] -join "`n") | ConvertFrom-Json -ErrorAction Stop
}

'[Presentasi] Memeriksa Docker Desktop...'
$engine = & docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0) {
    throw 'Docker daemon belum dapat diakses. Jalankan Docker Desktop terlebih dahulu.'
}
if ($engine.Trim() -ne 'linux') {
    throw 'Lingkungan M3 memerlukan Docker Desktop Linux containers.'
}

& docker compose -f $composeFile config --quiet
if ($LASTEXITCODE -ne 0) {
    throw 'Konfigurasi Compose tidak valid atau plugin Docker Compose belum tersedia.'
}

'[Presentasi] Menyiapkan lingkungan M3 dan menunggu endpoint siap...'
& docker compose -f $composeFile run --rm start-m3
if ($LASTEXITCODE -ne 0) {
    throw 'Startup M3 gagal. Periksa pesan Compose di atas.'
}

'=== 1. Node Kubernetes ==='
& kubectl --context k3d-capstone --request-timeout=10s get nodes
if ($LASTEXITCODE -ne 0) { throw 'Status node belum dapat ditampilkan.' }

'=== 2. Workload, endpoint, dan storage ==='
& kubectl --context k3d-capstone --request-timeout=10s -n default get deployment,pods,service,ingress,pvc
if ($LASTEXITCODE -ne 0) { throw 'Status workload belum dapat ditampilkan.' }

'=== 3. Readiness API langsung ==='
$health = Get-JournalFitResponse "$api/health/ready" 200
if ($health.status -ne 'ready' -or $health.database -ne 'connected') {
    throw 'Readiness tidak menyatakan database connected.'
}
'[Demo] Readiness HTTP 200'
$health | Format-List status, database, timestamp

'=== 4. Laporan naskah demo dari API ==='
$tenant = 'tenant-m3-demo'
$id = 'ms-519b3203'
if ($UploadFixture) {
    # The backend adds tpl- and -default to this ID for a VARCHAR(50) column.
    $tenant = 's7-' + [guid]::NewGuid().ToString('N')
    $uploadOptions = @('-H', "X-Tenant-ID: $tenant", '-F', "file=@$fixture")
    $upload = Get-JournalFitResponse "$api/api/manuscripts/upload" 201 $uploadOptions
    $id = $upload.data.manuscript.id
    if (-not $upload.success -or -not $id -or $upload.data.manuscript.tenant_id -ne $tenant) {
        throw 'Respons upload tidak memuat ID naskah untuk tenant demo.'
    }
    "[Demo] Upload HTTP 201: $id (tenant $tenant)"
}
$reportOptions = @('-H', "X-Tenant-ID: $tenant")
try {
    $report = Get-JournalFitResponse "$api/api/manuscripts/$id/report" 200 $reportOptions
} catch {
    if (-not $UploadFixture) {
        throw "Laporan demo lama tidak dapat dibaca. Gunakan -UploadFixture setelah lab siap. $($_.Exception.Message)"
    }
    throw
}
if (-not $report.success -or $report.data.manuscript.id -ne $id -or `
    $report.data.manuscript.tenant_id -ne $tenant -or $report.data.checkResult.status -ne 'COMPLETED') {
    throw 'Laporan demo tidak cocok dengan naskah/tenant atau pemeriksaan belum COMPLETED.'
}
if ($UploadFixture -and $report.data.checkResult.format_score -ne 100) {
    throw 'Skor DOCX sintetis berbeda dari baseline 100.'
}
"[Demo] Report HTTP 200: $id (tenant $tenant)"
$report.data.manuscript | Format-List id, tenant_id, title, file_path
$report.data.checkResult | Format-List status, format_score
$report.data.findings | Format-Table rule_type, severity, message -Wrap

"[Presentasi] Siap: $url"
if ($BukaBrowser) {
    Start-Process -FilePath $url -ErrorAction Stop
}
