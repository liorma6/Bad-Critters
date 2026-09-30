$ErrorActionPreference = 'Stop'
$studioRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$studioUrl = 'http://127.0.0.1:4175/creator/'
try { $studioRunning = (Invoke-WebRequest -UseBasicParsing -Uri ($studioUrl + 'api/catalogue') -TimeoutSec 2).StatusCode -eq 200 } catch { $studioRunning = $false }
if (-not $studioRunning) {
    $studioNode = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $studioNode -ArgumentList 'tools/creator/server.mjs' -WorkingDirectory $studioRoot -WindowStyle Hidden
    for ($studioAttempt = 0; $studioAttempt -lt 30; $studioAttempt++) {
        Start-Sleep -Milliseconds 300
        try { $studioRunning = (Invoke-WebRequest -UseBasicParsing -Uri ($studioUrl + 'api/catalogue') -TimeoutSec 2).StatusCode -eq 200; if ($studioRunning) { break } } catch {}
    }
}
if (-not $studioRunning) { throw 'The local studio could not start. Run npm run studio in the game folder to see the error.' }
$studioChrome = Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'
if (Test-Path -LiteralPath $studioChrome) { Start-Process -FilePath $studioChrome -ArgumentList $studioUrl } else { Start-Process $studioUrl }
