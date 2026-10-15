<#
  Membaca .env di root proyek lalu menghasilkan js/config.local.js
  sehingga API key ikut terpakai saat aplikasi di-deploy.

  Pakai:  powershell -ExecutionPolicy Bypass -File scripts\apply-env.ps1
#>

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env'
$outPath = Join-Path $root 'js\config.local.js'

if (-not (Test-Path -LiteralPath $envPath)) {
  Write-Error "File .env tidak ditemukan. Salin .env.example menjadi .env lalu isi YOUTUBE_API_KEY."
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
  $trimmed = $line.Trim()
  if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
  $idx = $trimmed.IndexOf('=')
  if ($idx -lt 1) { continue }
  $name = $trimmed.Substring(0, $idx).Trim()
  $value = $trimmed.Substring($idx + 1).Trim().Trim('"')
  $values[$name] = $value
}

$apiKey = ''
if ($values.ContainsKey('YOUTUBE_API_KEY')) { $apiKey = $values['YOUTUBE_API_KEY'] }

$instances = @()
if ($values.ContainsKey('INVIDIOUS_INSTANCES') -and $values['INVIDIOUS_INSTANCES'] -ne '') {
  $instances = $values['INVIDIOUS_INSTANCES'].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
}

$json = "window.APP_CONFIG = {`n  youtubeApiKey: " + (ConvertTo-Json $apiKey -Compress) + ",`n  invidiousInstances: [" + (($instances | ForEach-Object { ConvertTo-Json $_ -Compress }) -join ', ') + "]`n};`n"

Set-Content -LiteralPath $outPath -Value $json -Encoding UTF8

Write-Host "js/config.local.js diperbarui." -ForegroundColor Green
if ($apiKey -eq '') {
  Write-Host "Peringatan: YOUTUBE_API_KEY masih kosong di .env" -ForegroundColor Yellow
}
