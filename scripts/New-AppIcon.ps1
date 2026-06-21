param(
    [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "assets\odoo-rust-mcp.ico")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-IconPng {
    param([int]$Size)

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $scale = $Size / 64.0
    $graphics.ScaleTransform($scale, $scale)

    $surface = [System.Drawing.ColorTranslator]::FromHtml("#111827")
    $accent = [System.Drawing.ColorTranslator]::FromHtml("#4f8cff")
    $hexagon = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(32, 3.5),
        [System.Drawing.PointF]::new(55.5, 17),
        [System.Drawing.PointF]::new(55.5, 47),
        [System.Drawing.PointF]::new(32, 60.5),
        [System.Drawing.PointF]::new(8.5, 47),
        [System.Drawing.PointF]::new(8.5, 17)
    )

    $surfaceBrush = New-Object System.Drawing.SolidBrush($surface)
    $accentBrush = New-Object System.Drawing.SolidBrush($accent)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $accentPen = New-Object System.Drawing.Pen($accent, 3)
    $accentPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $accentPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $accentPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 4)

    $graphics.FillPolygon($surfaceBrush, $hexagon)
    $graphics.DrawPolygon($accentPen, $hexagon)
    $graphics.DrawLine($accentPen, 21, 37.5, 16.5, 42)
    $graphics.DrawLine($accentPen, 43, 37.5, 47.5, 42)
    $graphics.DrawLine($accentPen, 32, 20, 32, 14)
    $graphics.DrawEllipse($whitePen, 21, 21, 22, 22)
    $graphics.FillEllipse($whiteBrush, 28.5, 9.5, 7, 7)
    $graphics.FillEllipse($whiteBrush, 11.5, 40.5, 7, 7)
    $graphics.FillEllipse($whiteBrush, 45.5, 40.5, 7, 7)
    $graphics.FillEllipse($accentBrush, 29, 29, 6, 6)

    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $stream.ToArray()

    $stream.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    $surfaceBrush.Dispose()
    $accentBrush.Dispose()
    $whiteBrush.Dispose()
    $accentPen.Dispose()
    $whitePen.Dispose()

    return ,$bytes
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$frames = @($sizes | ForEach-Object { ,(New-IconPng -Size $_) })
$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$file = [System.IO.File]::Create($OutputPath)
$writer = New-Object System.IO.BinaryWriter($file)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$frames.Count)

$offset = 6 + (16 * $frames.Count)
for ($index = 0; $index -lt $frames.Count; $index++) {
    $size = $sizes[$index]
    $frame = $frames[$index]
    $writer.Write([byte]($(if ($size -eq 256) { 0 } else { $size })))
    $writer.Write([byte]($(if ($size -eq 256) { 0 } else { $size })))
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$frame.Length)
    $writer.Write([uint32]$offset)
    $offset += $frame.Length
}

foreach ($frame in $frames) {
    $writer.Write($frame)
}

$writer.Dispose()
$file.Dispose()
Write-Host "Generated $OutputPath with $($sizes.Count) icon sizes."
