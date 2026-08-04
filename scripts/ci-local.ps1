[CmdletBinding()]
param(
    [switch]$SkipBrowsers,
    [switch]$SkipContainers,
    [ValidateRange(1, 60)]
    [int]$FuzzSeconds = 5
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$qualityDirectory = Join-Path $repositoryRoot '.quality-data'
$coverageFile = Join-Path $qualityDirectory 'go-coverage.out'
$containerName = 'netdiagram-ci-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$imageName = 'netdiagram:ci-local'
$gitExecutable = (Get-Command git -ErrorAction Stop).Source
$gitRoot = Split-Path -Parent (Split-Path -Parent $gitExecutable)
$gitBash = Join-Path $gitRoot 'bin\bash.exe'
if (-not (Test-Path -LiteralPath $gitBash -PathType Leaf)) {
    throw "Git Bash was not found at $gitBash"
}

function Invoke-Gate {
    param(
        [Parameter(Mandatory)]
        [string]$Name,
        [Parameter(Mandatory)]
        [scriptblock]$Body
    )

    Write-Host "`n==> $Name" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    & $Body
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

Set-Location -LiteralPath $repositoryRoot
New-Item -ItemType Directory -Force -Path $qualityDirectory | Out-Null

Invoke-Gate 'Go formatting' {
    $unformatted = @(gofmt -l .)
    if ($unformatted.Count -gt 0) {
        throw "gofmt is required for: $($unformatted -join ', ')"
    }
}
Invoke-Gate 'Go vet' { go vet ./... }
Invoke-Gate 'golangci-lint' { golangci-lint run --timeout=5m ./... }
Invoke-Gate 'Go race and coverage tests' { go test -race -covermode=atomic "-coverprofile=$coverageFile" ./... }
Invoke-Gate 'Go coverage floor' { go run ./cmd/checkcoverage -profile $coverageFile -minimum 60 }
Invoke-Gate 'Topology JSON fuzzing' { go test ./internal/model -run='^$' -fuzz=FuzzTopologyJSON "-fuzztime=${FuzzSeconds}s" }
Invoke-Gate 'Request JSON fuzzing' { go test ./internal/handler -run='^$' -fuzz=FuzzDecodeJSON "-fuzztime=${FuzzSeconds}s" }
Invoke-Gate 'Go vulnerability scan' { go run golang.org/x/vuln/cmd/govulncheck@v1.6.0 ./... }
Invoke-Gate 'Go security scan' { go run github.com/securego/gosec/v2/cmd/gosec@v2.28.0 -quiet ./... }
Invoke-Gate 'Git history secret scan' { go run github.com/zricethezav/gitleaks/v8@v8.30.1 git --redact --no-banner . }

Invoke-Gate 'Locked frontend install' { npm ci --ignore-scripts }
Invoke-Gate 'Frontend dependency audit' { npm audit --audit-level=high }
Invoke-Gate 'JavaScript syntax' {
    $javascriptFiles = Get-ChildItem -LiteralPath web, scripts, e2e -Recurse -File |
        Where-Object { $_.Extension -in '.js', '.mjs' }
    foreach ($file in $javascriptFiles) {
        node --check $file.FullName
        if ($LASTEXITCODE -ne 0) {
            break
        }
    }
}
Invoke-Gate 'Frontend unit coverage' { npm run test:coverage }
Invoke-Gate 'Mutation smoke test' { & $gitBash scripts/mutation-smoke.sh }
Invoke-Gate 'GitHub Actions syntax' { go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 }
Invoke-Gate 'GitHub Actions security' { uvx zizmor==1.29.0 --persona=pedantic . }

if (-not $SkipContainers) {
    Invoke-Gate 'ShellCheck' {
        docker run --rm --volume "${repositoryRoot}:/mnt:ro" `
            koalaman/shellcheck-alpine@sha256:9955be09ea7f0dbf7ae942ac1f2094355bb30d96fffba0ec09f5432207544002 `
            /bin/shellcheck /mnt/scripts/mutation-smoke.sh
    }
    Invoke-Gate 'Hadolint' {
        Get-Content -Raw -LiteralPath Dockerfile |
            docker run --rm --interactive `
                hadolint/hadolint@sha256:3c206a451cec6d486367e758645269fd7d696c5ccb6ff59d8b03b0e45268a199
    }
    Invoke-Gate 'Container build' { docker build --tag $imageName . }
    try {
        Invoke-Gate 'Container health' {
            docker run --detach --name $containerName $imageName
            $healthy = $false
            foreach ($attempt in 1..20) {
                docker exec $containerName /netdiagram -healthcheck *> $null
                if ($LASTEXITCODE -eq 0) {
                    $healthy = $true
                    break
                }
                Start-Sleep -Seconds 1
            }
            if (-not $healthy) {
                docker logs $containerName
                throw 'Container did not become healthy'
            }
        }
    }
    finally {
        docker rm --force $containerName *> $null
    }
    Invoke-Gate 'Trivy filesystem scan' {
        docker run --rm --volume "${repositoryRoot}:/workspace:ro" `
            --volume netdiagram-trivy-cache:/root/.cache/trivy --workdir /workspace `
            aquasec/trivy@sha256:bcc376de8d77cfe086a917230e818dc9f8528e3c852f7b1aff648949b6258d1c `
            filesystem --scanners vuln,secret,misconfig --severity HIGH,CRITICAL `
            --skip-dirs node_modules --skip-dirs graphify-out --skip-dirs .quality-data `
            --skip-dirs coverage --skip-dirs test-results --ignore-unfixed `
            --skip-version-check --exit-code 1 .
    }
    Invoke-Gate 'Trivy container scan' {
        docker run --rm --volume /var/run/docker.sock:/var/run/docker.sock `
            --volume netdiagram-trivy-cache:/root/.cache/trivy `
            aquasec/trivy@sha256:bcc376de8d77cfe086a917230e818dc9f8528e3c852f7b1aff648949b6258d1c `
            image --scanners vuln,secret --severity HIGH,CRITICAL --ignore-unfixed `
            --skip-version-check --exit-code 1 $imageName
    }
    Invoke-Gate 'SPDX SBOM generation' {
        docker run --rm --volume "${repositoryRoot}:/workspace" --workdir /workspace `
            anchore/syft@sha256:1288ea4c8b38767b4e620c1e312c8cb26b6e887a99b4f07ab6cd19fc6f225026 `
            "dir:/workspace" --source-name netdiagram --source-version local `
            -o "spdx-json=/workspace/.quality-data/netdiagram.spdx.json"
    }
}

if (-not $SkipBrowsers) {
    Invoke-Gate 'Playwright browser matrix' { npm run test:e2e }
    Invoke-Gate 'Microsoft Edge' { npm run test:edge }
    Invoke-Gate 'Accessibility' { npm run test:a11y }
    Invoke-Gate 'Visual regression' { npm run test:visual }
}

if (Get-Command act -ErrorAction SilentlyContinue) {
    Invoke-Gate 'GitHub Actions job discovery' { act --list }
}

Write-Host "`nAll locally reproducible CI gates passed." -ForegroundColor Green
Write-Host 'GitHub-hosted integrations still run remotely: CodeQL upload, dependency review API, Scorecard publication, and Sigstore attestations.'
