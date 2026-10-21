# One scheduled collection run (Windows Task Scheduler starts it every hour; an hour that finds
# the previous run still going is skipped). Resumable, so a run stopped by an expired dev key
# continues from where it was once .env has a fresh key.
#
#   powershell -NoProfile -File scripts\collect-scheduled.ps1 -Root C:\path\to\checkout-with-db
#
# -Root holds .env, .venv and lol_duo.sqlite (defaults to this checkout). With -Postgres the run writes
# to DATABASE_URL from .env (Neon) instead of the SQLite file; copy the file over once first with
# data/to_postgres.py.
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [int]$PlayersPerTier = 1000,
    [int]$MatchesPerPlayer = 40,
    [switch]$Postgres
)

$log = Join-Path $Root "collect-scheduled.log"
$env:DUO_ENV = Join-Path $Root ".env"
$env:PYTHONIOENCODING = "utf-8"
$python = Join-Path $Root ".venv\Scripts\python.exe"
$collect = Join-Path $PSScriptRoot "..\data\collect.py"
if ($Postgres -and -not (Select-String -Path $env:DUO_ENV -Pattern '^\s*DATABASE_URL\s*=\s*\S' -Quiet)) {
    "$(Get-Date -Format s) -Postgres needs DATABASE_URL in $($env:DUO_ENV); not running" | Out-File $log -Append -Encoding utf8
    exit 1
}
$db = if ($Postgres) { @() } else { @("--db", (Join-Path $Root "lol_duo.sqlite")) }

"$(Get-Date -Format s) run started" | Out-File $log -Append -Encoding utf8
& $python -u $collect --ladder --players-per-tier $PlayersPerTier --matches-per-player $MatchesPerPlayer `
    @db 2>&1 | ForEach-Object { "$_" } | Out-File $log -Append -Encoding utf8
$code = $LASTEXITCODE
$why = switch ($code) {
    0 { "finished" }
    2 { "KEY REJECTED: regenerate the dev key at developer.riotgames.com and put it in $($env:DUO_ENV)" }
    default { "stopped with exit code $code (the next hourly run retries)" }
}
"$(Get-Date -Format s) run $why" | Out-File $log -Append -Encoding utf8
exit $code
