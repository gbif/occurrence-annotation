<# 
.SYNOPSIS
  Clean-restarts Docker Desktop (WSL2) and waits until the engine responds.

.PARAMETER DeepFix
  If the engine won’t start, temporarily moves daemon.json aside and retries.

.PARAMETER ResetNetworking
  Runs 'netsh winsock reset' and 'netsh int ip reset' (requires Admin + reboot).

.NOTES
  - Non-destructive. Does NOT delete images/volumes.
  - Uses a session-only DOCKER_API_VERSION=1.43 to dodge rare negotiation bugs.
#>

param(
  [switch]$DeepFix,
  [switch]$ResetNetworking
)

# --- Config ---
$DockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$DaemonCfg = "C:\ProgramData\Docker\config\daemon.json"

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p  = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Host "Elevating to Administrator..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File","`"$PSCommandPath`"",$($PSBoundParameters.Keys | ForEach-Object { "-$_" })"
    exit
  }
}

function Stop-Docker {
  Write-Host "Stopping Docker Desktop & WSL..." -ForegroundColor Cyan
  wsl --shutdown 2>$null | Out-Null
  Get-Process -Name "Docker Desktop","com.docker.backend" -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}

function Start-Docker {
  if (-not (Test-Path $DockerExe)) { throw "Docker Desktop not found at: $DockerExe" }
  Write-Host "Starting Docker Desktop..." -ForegroundColor Cyan
  Start-Process $DockerExe | Out-Null
}

function Test-DockerReady {
  param([int]$TimeoutSec = 120)
  $env:DOCKER_API_VERSION = "1.43"   # session-only workaround
  $sw = [Diagnostics.Stopwatch]::StartNew()
  do {
    Start-Sleep -Milliseconds 800
    try {
      $v = docker version --format '{{.Server.Version}}' 2>$null
      if ($LASTEXITCODE -eq 0 -and $v) {
        Write-Host "Docker engine is up (version $v)" -ForegroundColor Green
        return $true
      }
    } catch { }
    Write-Host -NoNewline "."
  } while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec)
  Write-Host ""
  return $false
}

function Backup-DaemonJson {
  if (Test-Path $DaemonCfg) {
    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    $bak = "$DaemonCfg.bak_$stamp"
    Rename-Item $DaemonCfg $bak -ErrorAction SilentlyContinue
    Write-Host "Moved daemon.json to: $bak" -ForegroundColor Yellow
  }
}

function Reset-Networking {
  Assert-Admin
  Write-Host "Resetting Winsock & IP stack (requires reboot)..." -ForegroundColor Yellow
  & netsh winsock reset
  & netsh int ip reset
  Write-Host "Done. Please reboot for changes to take effect." -ForegroundColor Yellow
}

# --- Main ---
if ($ResetNetworking) {
  Reset-Networking
  return
}

# Step 1: Clean stop
Stop-Docker

# Step 2: Start and wait
Start-Docker
if (Test-DockerReady -TimeoutSec 150) { return }

# Step 3: Optional deeper fix (bypass bad daemon.json), then retry once
if ($DeepFix) {
  Write-Host "Engine still not up. Applying DeepFix (daemon.json bypass)..." -ForegroundColor Yellow
  Stop-Docker
  Backup-DaemonJson
  Start-Docker
  if (Test-DockerReady -TimeoutSec 180) { return }
}

Write-Host "Docker still not responding. Consider running with -ResetNetworking and rebooting, or check %LOCALAPPDATA%\Docker\log.txt." -ForegroundColor Red
exit 1
