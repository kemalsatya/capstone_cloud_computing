param(
    [Parameter(Mandatory = $true)][string]$Image,
    [string]$PostgresContainer = 'capstone-postgres',
    [string]$Database = 'journalfit',
    [string]$Network = 'capstone-net',
    [string]$EvidenceDirectory = 'evidence/platform/tahap-2'
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$evidenceParent = Join-Path $root $EvidenceDirectory
if (-not (Test-Path -LiteralPath $evidenceParent -PathType Container)) {
    throw "Parent evidence belum tersedia: $EvidenceDirectory"
}
$runId = 'run-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$runDirectory = Join-Path $evidenceParent $runId
$null = New-Item -ItemType Directory -Path $runDirectory
$utf8 = New-Object System.Text.UTF8Encoding($false)
$temporaryContainers = New-Object 'System.Collections.Generic.List[string]'
$temporaryVolume = $null
$originalPassword = [Environment]::GetEnvironmentVariable('DB_PASSWORD', 'Process')
$client = $null
$failure = $null
$result = [ordered]@{
    scope = 'Stage 2: production image and isolated Docker runtime checks'
    startedAt = [DateTimeOffset]::Now.ToString('o')
    image = $Image
    status = 'running'
    checks = [ordered]@{}
}

function Invoke-Docker {
    param([string[]]$Arguments, [switch]$AllowFailure)
    $previousPreference = $ErrorActionPreference
    try {
        # PowerShell 5.1 can wrap native stderr as ErrorRecord even on exit 0.
        $ErrorActionPreference = 'Continue'
        $output = & docker @Arguments 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    $text = (@($output) | ForEach-Object { $_.ToString() }) -join "`n"
    if ($code -ne 0 -and -not $AllowFailure) {
        throw "docker $($Arguments[0]) failed (exit $code): $text"
    }
    return [pscustomobject]@{ Text = $text; ExitCode = $code }
}

function Save-Artifact {
    param([string]$Name, [string]$Text)
    [System.IO.File]::WriteAllText((Join-Path $runDirectory $Name), $Text + "`n", $utf8)
}

function Get-JsonResponse {
    param([string]$Url)
    $response = $client.GetAsync($Url).GetAwaiter().GetResult()
    try {
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        return [pscustomobject]@{ statusCode = [int]$response.StatusCode; body = ($body | ConvertFrom-Json) }
    } finally {
        $response.Dispose()
    }
}

function Wait-Http {
    param([string]$Url, [int]$ExpectedStatus)
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $response = Get-JsonResponse $Url
            if ($response.statusCode -eq $ExpectedStatus) { return $response }
        } catch {
            # Startup connection failures are retried; the final timeout fails the run.
        }
        Start-Sleep -Seconds 1
    }
    throw "Endpoint did not reach HTTP $ExpectedStatus within the retry window: $Url"
}

function Start-ProbeContainer {
    param([string]$Suffix, [string]$DatabaseName, [switch]$WithVolume)
    $name = 'journalfit-stage2-' + $runId + '-' + $Suffix
    $existing = Invoke-Docker -Arguments @('container', 'inspect', $name) -AllowFailure
    if ($existing.ExitCode -eq 0) { throw "Probe container name already exists: $name" }
    $temporaryContainers.Add($name)
    $arguments = @('run', '--detach', '--rm', '--name', $name, '--network', $Network,
        '--publish', '127.0.0.1::8000', '--env', 'PORT=8000', '--env', 'NODE_ENV=production',
        '--env', "DB_HOST=$PostgresContainer", '--env', 'DB_PORT=5432',
        '--env', "DB_NAME=$DatabaseName", '--env', "DB_USER=$postgresUser", '--env', 'DB_PASSWORD')
    if ($WithVolume) { $arguments += @('--mount', "type=volume,source=$temporaryVolume,target=/app/uploads") }
    $arguments += $Image
    $null = Invoke-Docker -Arguments $arguments
    $mapping = (Invoke-Docker -Arguments @('port', $name, '8000/tcp')).Text.Trim()
    if ($mapping -notmatch '^127\.0\.0\.1:(\d+)$') { throw "Unexpected probe port mapping: $mapping" }
    return [pscustomobject]@{ Name = $name; Url = "http://127.0.0.1:$($Matches[1])" }
}

try {
    $imageInfo = @((Invoke-Docker -Arguments @('image', 'inspect', $Image)).Text | ConvertFrom-Json)[0]
    $result.imageId = $imageInfo.Id
    $result.imageConfiguration = [ordered]@{
        user = $imageInfo.Config.User
        workingDirectory = $imageInfo.Config.WorkingDir
        entrypoint = $imageInfo.Config.Entrypoint
        command = $imageInfo.Config.Cmd
        labels = $imageInfo.Config.Labels
    }
    if ($imageInfo.Config.User -ne '10001:10001' -or $imageInfo.Config.WorkingDir -ne '/app') {
        throw 'Image user or working directory differs from the Stage 2 contract.'
    }
    $result.checks.identity = (Invoke-Docker -Arguments @('run', '--rm', '--network', 'none', '--entrypoint', 'id', $Image)).Text
    $result.checks.nodeVersion = (Invoke-Docker -Arguments @('run', '--rm', '--network', 'none', '--entrypoint', 'node', $Image, '--version')).Text
    if ($result.checks.nodeVersion -notmatch '^v22\.') { throw 'Runtime is not Node 22.' }
    $null = Invoke-Docker -Arguments @('run', '--rm', '--network', 'none', '--entrypoint', 'sh', $Image, '-c',
        'test -w /app/uploads && test ! -w /app/package.json && test ! -e /app/.env && test ! -e /app/.env.example && test ! -e /app/schema.sql && test ! -d /app/tests && test ! -d /app/node_modules/nodemon')
    $result.checks.productionFilesystem = 'PASS: uploads writable; package manifest read-only; local config, schema, tests and nodemon absent'
    Save-Artifact 'dependencies.json' (Invoke-Docker -Arguments @('run', '--rm', '--network', 'none', '--entrypoint', 'npm', $Image, 'ls', '--omit=dev', '--depth=0', '--json')).Text

    $testsPath = Join-Path $root 'source/tests'
    $tests = Invoke-Docker -Arguments @('run', '--rm', '--network', 'none', '--mount', "type=bind,source=$testsPath,target=/app/tests,readonly", $Image, 'npm', 'test', '--', '--test-reporter=tap')
    Save-Artifact 'application-tests.tap' $tests.Text
    $result.checks.applicationTests = [ordered]@{ exitCode = $tests.ExitCode; log = 'application-tests.tap' }

    # Inspect configuration in memory only. Never persist the inspect JSON or password.
    $postgres = @((Invoke-Docker -Arguments @('container', 'inspect', $PostgresContainer)).Text | ConvertFrom-Json)[0]
    if (-not $postgres.State.Running -or $postgres.NetworkSettings.Networks.PSObject.Properties.Name -notcontains $Network) {
        throw 'PostgreSQL is not running on the requested network; inspect infrastructure before retrying.'
    }
    $postgresEnvironment = @{}
    foreach ($entry in $postgres.Config.Env) {
        $parts = $entry -split '=', 2
        $postgresEnvironment[$parts[0]] = $parts[1]
    }
    $postgresUser = $postgresEnvironment['POSTGRES_USER']
    if (-not $postgresUser -or -not $postgresEnvironment['POSTGRES_PASSWORD']) {
        throw 'The existing lab PostgreSQL configuration does not provide the required local credentials.'
    }
    $null = Invoke-Docker -Arguments @('exec', $PostgresContainer, 'psql', '-U', $postgresUser, '-d', $Database, '-Atc', 'SELECT 1')
    [Environment]::SetEnvironmentVariable('DB_PASSWORD', $postgresEnvironment['POSTGRES_PASSWORD'], 'Process')
    $result.database = [ordered]@{ container = $PostgresContainer; database = $Database; network = $Network; operations = 'SELECT 1 only' }

    $volumeName = 'journalfit-stage2-' + $runId + '-uploads'
    if ((Invoke-Docker -Arguments @('volume', 'inspect', $volumeName) -AllowFailure).ExitCode -eq 0) {
        throw "Probe volume name already exists: $volumeName"
    }
    $null = Invoke-Docker -Arguments @('volume', 'create', $volumeName)
    $temporaryVolume = $volumeName
    Add-Type -AssemblyName System.Net.Http
    $client = New-Object System.Net.Http.HttpClient
    $client.Timeout = [TimeSpan]::FromSeconds(5)

    $positive = Start-ProbeContainer -Suffix 'positive' -DatabaseName $Database -WithVolume
    $result.checks.live = Wait-Http -Url ($positive.Url + '/health/live') -ExpectedStatus 200
    $result.checks.ready = Wait-Http -Url ($positive.Url + '/health/ready') -ExpectedStatus 200
    $result.checks.root = Get-JsonResponse ($positive.Url + '/')
    if ($result.checks.root.statusCode -ne 200) { throw 'Root endpoint did not return 200.' }
    $result.checks.pid1 = (Invoke-Docker -Arguments @('exec', $positive.Name, 'cat', '/proc/1/comm')).Text
    $null = Invoke-Docker -Arguments @('exec', $positive.Name, 'sh', '-c', 'printf stage2-volume-check > /app/uploads/.stage2-volume-check')
    Save-Artifact 'runtime-positive.log' (Invoke-Docker -Arguments @('logs', $positive.Name)).Text

    $missingDatabase = 'stage2_missing_' + [guid]::NewGuid().ToString('N')
    $negative = Start-ProbeContainer -Suffix 'negative' -DatabaseName $missingDatabase
    $result.checks.liveWithoutDatabase = Wait-Http -Url ($negative.Url + '/health/live') -ExpectedStatus 200
    $result.checks.unready = Wait-Http -Url ($negative.Url + '/health/ready') -ExpectedStatus 503
    Save-Artifact 'runtime-negative.log' (Invoke-Docker -Arguments @('logs', $negative.Name)).Text

    $null = Invoke-Docker -Arguments @('stop', '--timeout', '10', $positive.Name)
    $persisted = (Invoke-Docker -Arguments @('run', '--rm', '--network', 'none', '--mount', "type=volume,source=$temporaryVolume,target=/app/uploads,readonly", '--entrypoint', 'cat', $Image, '/app/uploads/.stage2-volume-check')).Text
    if ($persisted -ne 'stage2-volume-check') { throw 'Docker volume marker did not survive container removal.' }
    $result.checks.dockerVolume = 'PASS: marker written as UID 10001 and read from a new container'
    $result.status = 'passed'
} catch {
    $failure = $_.Exception.Message
    $result.status = 'failed'
    $result.failure = $failure
} finally {
    $cleanup = [ordered]@{ containers = @(); volume = $null }
    foreach ($name in $temporaryContainers) {
        $existing = Invoke-Docker -Arguments @('container', 'inspect', $name) -AllowFailure
        if ($existing.ExitCode -eq 0) {
            $removed = Invoke-Docker -Arguments @('rm', '--force', $name) -AllowFailure
            $cleanup.containers += [ordered]@{ name = $name; removed = ($removed.ExitCode -eq 0) }
        } else {
            $cleanup.containers += [ordered]@{ name = $name; alreadyRemoved = $true }
        }
    }
    if ($temporaryVolume) {
        $removed = Invoke-Docker -Arguments @('volume', 'rm', $temporaryVolume) -AllowFailure
        $cleanup.volume = [ordered]@{ name = $temporaryVolume; removed = ($removed.ExitCode -eq 0) }
    }
    [Environment]::SetEnvironmentVariable('DB_PASSWORD', $originalPassword, 'Process')
    if ($client) { $client.Dispose() }
    $result.cleanup = $cleanup
    $result.finishedAt = [DateTimeOffset]::Now.ToString('o')
    Save-Artifact 'results.json' ($result | ConvertTo-Json -Depth 15)
}

"Evidence: $runDirectory"
"Stage 2 verification: $($result.status)"
if ($failure) { throw $failure }
