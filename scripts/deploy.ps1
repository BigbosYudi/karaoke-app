<#
  Deploy ke GitHub Pages memakai kredensial dari .env lokal.

  Membaca: GITHUB_USER, GITHUB_REPO, GIT_TOKEN
  Lalu: set remote origin, push branch main, dan mencoba mengaktifkan Pages.

  Pakai: powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
#>

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env'

if (-not (Test-Path -LiteralPath $envPath)) {
  Write-Error "File .env tidak ditemukan."
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
  $trimmed = $line.Trim()
  if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
  $idx = $trimmed.IndexOf('=')
  if ($idx -lt 1) { continue }
  $values[$trimmed.Substring(0, $idx).Trim()] = $trimmed.Substring($idx + 1).Trim().Trim('"')
}

$user = $values['GITHUB_USER']
$repo = $values['GITHUB_REPO']
$token = $values['GIT_TOKEN']

if ([string]::IsNullOrWhiteSpace($user)) { Write-Error "GITHUB_USER masih kosong di .env" }
if ([string]::IsNullOrWhiteSpace($repo)) { Write-Error "GITHUB_REPO masih kosong di .env" }
if ([string]::IsNullOrWhiteSpace($token)) { Write-Error "GIT_TOKEN masih kosong di .env. Buat Personal Access Token dengan izin Contents: Read and write." }

$branch = 'main'
$remoteUrl = "https://$user@github.com/$user/$repo.git"
$pagesUrl = "https://$user.github.io/$repo/"

Push-Location $root
try {
  $current = (git branch --show-current).Trim()
  if ($current -ne $branch) { git branch -M $branch | Out-Null }

  $remotes = @(git remote)
  if ($remotes -contains 'origin') {
    git remote set-url origin $remoteUrl | Out-Null
  } else {
    git remote add origin $remoteUrl | Out-Null
  }
  Write-Host "Remote: $remoteUrl"

  # Simpan token di berkas sementara agar tidak tampil di command line.
  $askPass = Join-Path $env:TEMP ("git-askpass-" + [Guid]::NewGuid().ToString('N') + ".cmd")
  $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$token"))
  @"
@echo off
echo $token
"@ | Set-Content -LiteralPath $askPass -Encoding ASCII

  $savedEnv = @{}
  foreach ($name in @('GIT_ASKPASS', 'GIT_TERMINAL_PROMPT', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0')) {
    $savedEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
  }
  $env:GIT_ASKPASS = $askPass
  $env:GIT_TERMINAL_PROMPT = '0'
  $env:GIT_CONFIG_COUNT = '1'
  $env:GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
  $env:GIT_CONFIG_VALUE_0 = "AUTHORIZATION: basic $b64"

  try {
    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    git -c credential.helper= push -u origin $branch 2>&1 | ForEach-Object { Write-Host $_ }
    $pushCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPref
    if ($pushCode -ne 0) { throw "git push gagal (kode $pushCode). Periksa nama repo dan izin token (Contents: Read and write)." }
    Write-Host "Push berhasil." -ForegroundColor Green
  } finally {
    Remove-Item -LiteralPath $askPass -Force -ErrorAction SilentlyContinue
    foreach ($name in $savedEnv.Keys) {
      [Environment]::SetEnvironmentVariable($name, $savedEnv[$name], 'Process')
    }
  }

  # Cek dulu apakah GitHub Pages sudah aktif.
  $headers = @{
    'Authorization' = "Bearer $token"
    'Accept' = 'application/vnd.github+json'
    'User-Agent' = 'karaoke-deploy'
  }
  $pagesActive = $false
  try {
    $existing = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/$user/$repo/pages" -Headers $headers -TimeoutSec 30
    $pagesActive = $true
    Write-Host "GitHub Pages sudah aktif: $($existing.html_url)" -ForegroundColor Green
  } catch {
    $pagesActive = $false
  }

  # Aktifkan Pages bila belum aktif (butuh izin Pages: Read and write pada token).
  if (-not $pagesActive) {
    try {
      $body = @{ source = @{ branch = $branch; path = '/' } } | ConvertTo-Json -Depth 4
      $result = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$user/$repo/pages" -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSec 30
      Write-Host "GitHub Pages diaktifkan: $($result.html_url)" -ForegroundColor Green
    } catch {
      Write-Host "Pages belum aktif dan tidak bisa diaktifkan otomatis (token tanpa izin Pages)." -ForegroundColor Yellow
      Write-Host "Aktifkan manual: Settings -> Pages -> Source: Deploy from a branch -> $branch / (root) -> Save"
    }
  }

  Write-Host "`nAlamat aplikasi (tunggu 1-3 menit saat pertama kali):" -ForegroundColor Cyan
  Write-Host $pagesUrl -ForegroundColor Cyan
}
finally {
  Pop-Location
}
