<#
  Membuat semua ikon aplikasi dari logo Bigbos Yudi.

  Sumber default: icons\logo-source.png
  Hasil:
    icons\logo-96.png            logo transparan (header aplikasi)
    icons\logo-512.png           logo transparan resolusi besar
    icons\icon-192.png           ikon PWA
    icons\icon-512.png           ikon PWA
    icons\icon-maskable-512.png  ikon PWA (safe zone untuk mask Adaptive)
    icons\apple-touch-icon.png   ikon iOS/HP (180)
    icons\favicon-48.png         ikon tab browser
    icons\favicon-32.png         ikon tab browser

  Pakai: powershell -ExecutionPolicy Bypass -File scripts\make-icons.ps1
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root 'icons'
$source = Join-Path $iconDir 'logo-source.png'

if (-not (Test-Path -LiteralPath $source)) {
  Write-Error "Logo sumber tidak ditemukan: $source"
}

$BG = [System.Drawing.Color]::FromArgb(255, 247, 242, 232)

function Get-LogoBounds {
  param([System.Drawing.Bitmap]$Bitmap)
  $minX = $Bitmap.Width; $minY = $Bitmap.Height; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $Bitmap.Height; $y += 3) {
    for ($x = 0; $x -lt $Bitmap.Width; $x += 3) {
      if ($Bitmap.GetPixel($x, $y).A -gt 20) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt 0) { return (New-Object System.Drawing.Rectangle(0, 0, $Bitmap.Width, $Bitmap.Height)) }
  $pad = 6
  $x0 = [Math]::Max(0, $minX - $pad)
  $y0 = [Math]::Max(0, $minY - $pad)
  $w = [Math]::Min($Bitmap.Width - $x0, ($maxX - $minX) + ($pad * 2))
  $h = [Math]::Min($Bitmap.Height - $y0, ($maxY - $minY) + ($pad * 2))
  return (New-Object System.Drawing.Rectangle($x0, $y0, $w, $h))
}

function New-Canvas {
  param([int]$Size)
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Draw-RoundedBackground {
  param([System.Drawing.Graphics]$Graphics, [int]$Size, [double]$RadiusRatio)
  $r = [int]($Size * $RadiusRatio)
  if ($r -le 0) {
    $Graphics.Clear($BG)
    return
  }
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($Size - $d, 0, $d, $d, 270, 90)
  $path.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
  $path.AddArc(0, $Size - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.SolidBrush($BG)
  $Graphics.FillPath($brush, $path)
  $brush.Dispose()
  $path.Dispose()
}

function New-AppIcon {
  param(
    [System.Drawing.Bitmap]$Source,
    [System.Drawing.Rectangle]$Bounds,
    [int]$Size,
    [double]$FillRatio,
    [string]$OutPath,
    [double]$RadiusRatio
  )
  $ctx = New-Canvas -Size $Size
  Draw-RoundedBackground -Graphics $ctx.Graphics -Size $Size -RadiusRatio $RadiusRatio

  $target = [int]($Size * $FillRatio)
  $scale = [Math]::Min($target / $Bounds.Width, $target / $Bounds.Height)
  $w = [int]($Bounds.Width * $scale)
  $h = [int]($Bounds.Height * $scale)
  $x = [int](($Size - $w) / 2)
  $y = [int](($Size - $h) / 2)

  $dest = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
  $ctx.Graphics.DrawImage($Source, $dest, $Bounds.X, $Bounds.Y, $Bounds.Width, $Bounds.Height, [System.Drawing.GraphicsUnit]::Pixel)

  $ctx.Graphics.Dispose()
  $ctx.Bitmap.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $ctx.Bitmap.Dispose()
  Write-Host "Dibuat: $OutPath"
}

function New-PlainLogo {
  param(
    [System.Drawing.Bitmap]$Source,
    [System.Drawing.Rectangle]$Bounds,
    [int]$Size,
    [string]$OutPath
  )
  $ctx = New-Canvas -Size $Size
  $scale = [Math]::Min($Size / $Bounds.Width, $Size / $Bounds.Height)
  $w = [int]($Bounds.Width * $scale)
  $h = [int]($Bounds.Height * $scale)
  $x = [int](($Size - $w) / 2)
  $y = [int](($Size - $h) / 2)
  $dest = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
  $ctx.Graphics.DrawImage($Source, $dest, $Bounds.X, $Bounds.Y, $Bounds.Width, $Bounds.Height, [System.Drawing.GraphicsUnit]::Pixel)
  $ctx.Graphics.Dispose()
  $ctx.Bitmap.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $ctx.Bitmap.Dispose()
  Write-Host "Dibuat: $OutPath"
}

$src = New-Object System.Drawing.Bitmap($source)
$bounds = Get-LogoBounds -Bitmap $src
Write-Host ("Kotak logo sumber: {0},{1} {2}x{3}" -f $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height)

New-PlainLogo -Source $src -Bounds $bounds -Size 512 -OutPath (Join-Path $iconDir 'logo-512.png')
New-PlainLogo -Source $src -Bounds $bounds -Size 96 -OutPath (Join-Path $iconDir 'logo-96.png')

New-AppIcon -Source $src -Bounds $bounds -Size 512 -FillRatio 0.74 -OutPath (Join-Path $iconDir 'icon-512.png') -RadiusRatio 0.0
New-AppIcon -Source $src -Bounds $bounds -Size 192 -FillRatio 0.74 -OutPath (Join-Path $iconDir 'icon-192.png') -RadiusRatio 0.0
New-AppIcon -Source $src -Bounds $bounds -Size 512 -FillRatio 0.55 -OutPath (Join-Path $iconDir 'icon-maskable-512.png') -RadiusRatio 0.0
New-AppIcon -Source $src -Bounds $bounds -Size 180 -FillRatio 0.72 -OutPath (Join-Path $iconDir 'apple-touch-icon.png') -RadiusRatio 0.22
New-AppIcon -Source $src -Bounds $bounds -Size 48 -FillRatio 0.76 -OutPath (Join-Path $iconDir 'favicon-48.png') -RadiusRatio 0.22
New-AppIcon -Source $src -Bounds $bounds -Size 32 -FillRatio 0.78 -OutPath (Join-Path $iconDir 'favicon-32.png') -RadiusRatio 0.22

$src.Dispose()
Write-Host "Selesai." -ForegroundColor Green
