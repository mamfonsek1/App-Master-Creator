# Descarga de vídeos del curso "REFUERZO MASTER CREADOR LANS" (uso personal)
# Reanudable: si se corta, vuelve a ejecutarlo y continúa donde lo dejó.

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Maria\Downloads\Lans Studios'
$curl = 'C:\Windows\System32\curl.exe'
$log  = Join-Path $root 'descarga.log'
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json

function Clean([string]$s) {
    $s = $s.Normalize([System.Text.NormalizationForm]::FormC)
    $s = $s -replace '[<>:"/\\|?*\x00-\x1F]', '-'
    $s = $s -replace '\s+', ' '
    return $s.Trim().TrimEnd('.')
}

function Log([string]$msg) {
    $line = "{0} {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
    Write-Host $line
    Add-Content -Path $log -Value $line -Encoding UTF8
}

Log "=== Inicio: $($manifest.lessons.Count) lecciones ==="

$sectionOrder = @{}
$sectionCount = @{}
$done = 0; $skipped = 0; $failed = 0
$failedList = @()

foreach ($l in $manifest.lessons) {
    if (-not $l.url) { Log "SIN URL: $($l.title)"; $failed++; continue }

    $sec = Clean $l.section
    if (-not $sectionOrder.ContainsKey($sec)) {
        $sectionOrder[$sec] = $sectionOrder.Count + 1
        $sectionCount[$sec] = 0
    }
    $sectionCount[$sec]++
    $dir = Join-Path $root ("{0}. {1}" -f $sectionOrder[$sec], $sec)
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    $name = "{0:00} - {1}.mp4" -f $sectionCount[$sec], (Clean $l.title)
    $out = Join-Path $dir $name

    if ((Test-Path $out) -and ((Get-Item $out).Length -eq $l.bytes)) {
        $skipped++
        Log "OK (ya existe) $name"
        continue
    }

    $cargs = @('-L', '--fail', '--retry', '3', '--retry-delay', '2', '--silent', '--show-error')
    if (Test-Path $out) { $cargs += @('-C', '-') }
    $cargs += @('-o', $out, $l.url)

    Log "BAJANDO $name ($([math]::Round($l.bytes/1MB,1)) MB)"
    & $curl @cargs
    if ($LASTEXITCODE -ne 0) {
        $failed++
        $failedList += $name
        Log "ERROR $name (curl $LASTEXITCODE)"
    } else {
        $done++
        Log "HECHO  $name"
    }
}

Log "=== Fin: $done descargados, $skipped ya existían, $failed fallidos ==="
if ($failedList.Count -gt 0) {
    Log ("Fallidos: " + ($failedList -join ' | '))
    Log "Vuelve a ejecutar este script para reintentar."
}
