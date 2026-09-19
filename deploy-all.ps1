# deploy-all.ps1 - pembungkus supaya deploy-all.sh bisa dijalankan langsung
# dari PowerShell:  .\deploy-all.ps1 [--no-verify] [--dry-run] [--keep-index]
#
# Seluruh logika ada di deploy-all.sh; berkas ini hanya mencari Git Bash.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$bash = $null
$cmd = Get-Command bash -ErrorAction SilentlyContinue
if ($cmd) { $bash = $cmd.Source }

if (-not $bash) {
  foreach ($p in @("$env:ProgramFiles\Git\bin\bash.exe",
                   "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
                   "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe")) {
    if (Test-Path $p) { $bash = $p; break }
  }
}

if (-not $bash) {
  Write-Error "Git Bash tidak ditemukan. Pasang Git for Windows, atau jalankan: bash ./deploy-all.sh"
  exit 1
}

& $bash (Join-Path $root "deploy-all.sh") @args
exit $LASTEXITCODE
