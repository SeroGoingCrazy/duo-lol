# One scheduled sync of the site's data (data/sync_site.py) from the collector's SQLite file into Neon.
#
#   powershell -NoProfile -File scripts\sync-site-scheduled.ps1 -Root C:\path\to\checkout-with-db
#
# -Root holds .env, .venv, lol_duo.sqlite and web\.env.local. The Neon URL is DATABASE_URL from
# .env, else from web\.env.local (the site's own); it is passed through the environment, never logged.
param([string]$Root = (Split-Path -Parent $PSScriptRoot))

$log = Join-Path $Root "sync-site.log"
$env:DUO_ENV = Join-Path $Root ".env"
$env:PYTHONIOENCODING = "utf-8"
foreach ($file in @($env:DUO_ENV, (Join-Path $Root "web\.env.local"))) {
    if (-not $env:DATABASE_URL -and (Test-Path $file)) {
        $line = Select-String -Path $file -Pattern '^\s*DATABASE_URL\s*=\s*(\S+)' | Select-Object -First 1
        if ($line) { $env:DATABASE_URL = $line.Matches[0].Groups[1].Value.Trim('"', "'") }
    }
}
if (-not $env:DATABASE_URL) {
    "$(Get-Date -Format s) no DATABASE_URL in .env or web\.env.local; not syncing" | Out-File $log -Append -Encoding utf8
    exit 1
}

"$(Get-Date -Format s) sync started" | Out-File $log -Append -Encoding utf8
& (Join-Path $Root ".venv\Scripts\python.exe") -u (Join-Path $PSScriptRoot "..\data\sync_site.py") `
    (Join-Path $Root "lol_duo.sqlite") 2>&1 | ForEach-Object { "$_" } | Out-File $log -Append -Encoding utf8
$code = $LASTEXITCODE
"$(Get-Date -Format s) sync $(if ($code -eq 0) { 'finished' } else { "failed with exit code $code" })" |
    Out-File $log -Append -Encoding utf8
exit $code
