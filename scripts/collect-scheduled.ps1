# One scheduled collection run (Windows Task Scheduler starts it every hour; an hour that finds
# the previous run still going is skipped). Resumable, so a run stopped by an expired dev key
# continues from where it was once .env has a fresh key.
#
#   powershell -NoProfile -File scripts\collect-scheduled.ps1 -Root C:\path\to\checkout-with-db
#
# -Root holds .env, .venv and lol_duo.sqlite (defaults to this checkout).
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [int]$PlayersPerTier = 1000,
    [int]$MatchesPerPlayer = 40
)

$log = Join-Path $Root "collect-scheduled.log"
$env:DUO_ENV = Join-Path $Root ".env"
$env:PYTHONIOENCODING = "utf-8"
$python = Join-Path $Root ".venv\Scripts\python.exe"
$collect = Join-Path $PSScriptRoot "..\data\collect.py"

"$(Get-Date -Format s) run started" | Out-File $log -Append -Encoding utf8
& $python -u $collect --ladder --players-per-tier $PlayersPerTier --matches-per-player $MatchesPerPlayer `
    --db (Join-Path $Root "lol_duo.sqlite") 2>&1 | ForEach-Object { "$_" } | Out-File $log -Append -Encoding utf8
$code = $LASTEXITCODE
$why = switch ($code) {
    0 { "finished" }
    2 { "KEY REJECTED: regenerate the dev key at developer.riotgames.com and put it in $($env:DUO_ENV)" }
    default { "stopped with exit code $code (the next hourly run retries)" }
}
"$(Get-Date -Format s) run $why" | Out-File $log -Append -Encoding utf8
exit $code
