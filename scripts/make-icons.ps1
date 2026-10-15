<#
  Membuat ikon PNG (192 & 512) untuk manifest PWA.
  Pakai: powershell -ExecutionPolicy Bypass -File scripts\make-icons.ps1
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root 'icons'

function New-KaraokeIcon {
  param([int]$Size, [string]$OutPath)

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 255, 46, 136),
    [System.Drawing.Color]::FromArgb(255, 110, 60, 255),
    45.0
  )
  $g.FillRectangle($brush, $rect)

  $font = New-Object System.Drawing.Font('Segoe UI', [float]($Size * 0.5), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $box = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)
  $g.DrawString('K', $font, $white, $box, $format)

  $g.Dispose()
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Dibuat: $OutPath"
}

New-KaraokeIcon -Size 192 -OutPath (Join-Path $iconDir 'icon-192.png')
New-KaraokeIcon -Size 512 -OutPath (Join-Path $iconDir 'icon-512.png')
