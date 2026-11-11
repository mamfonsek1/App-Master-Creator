# Genera una distribución portable: app + recursos + vídeos en una carpeta.
#
#   powershell -ExecutionPolicy Bypass -File scripts\make-portable.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\make-portable.ps1 -Copiar
#
# Por defecto los vídeos se enlazan (junction), así no se duplican 5 GB.
# Con -Copiar se copian de verdad, para llevar la carpeta a otro equipo o USB.

param([switch]$Copiar)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$release = Join-Path $root "src-tauri\target\release"
$exe = Join-Path $release "aula-lans.exe"
$resources = Join-Path $release "resources"
$media = Join-Path $root "media"
$dest = Join-Path $root "dist\Aula Lans Portable"

if (-not (Test-Path $exe)) {
    throw "No existe $exe. Ejecuta antes: bun run desktop:build"
}

if (-not (Test-Path $resources)) {
    throw "No existen los recursos empaquetados. Ejecuta antes: bun run package:server"
}

if (-not (Test-Path $media)) {
    throw "No existe la carpeta media en $media"
}

Write-Host "· preparando $dest"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Write-Host "· copiando ejecutable y recursos"
Copy-Item $exe (Join-Path $dest "Aula Lans.exe")
Copy-Item $resources (Join-Path $dest "resources") -Recurse

if ($Copiar) {
    Write-Host "· copiando vídeos (5 GB, tarda un rato)"
    Copy-Item $media (Join-Path $dest "media") -Recurse
} else {
    Write-Host "· enlazando vídeos (sin duplicar espacio)"
    New-Item -ItemType Junction -Path (Join-Path $dest "media") -Target $media | Out-Null
}

@"
Aula Lans · Refuerzo Master Creador Lans
=======================================

Abre "Aula Lans.exe". La app detecta la carpeta "media" que está a su lado,
así que no tienes que elegir nada.

Cuentas
-------
María    usuario: maria     (administradora)
Hylary   usuario: hylary
Yeisy    usuario: yeisy

La contraseña temporal se cambia en Ajustes → Cambiar contraseña.

Datos
-----
Las cuentas y el progreso se guardan en:
  %APPDATA%\com.lans.aula\aula.db

Si mueves esta carpeta a otro equipo, esa base de datos NO viaja con ella.
Para llevarte el progreso, copia también ese archivo a la misma ruta allí.

Requisitos
----------
Windows 10 u 11 de 64 bits. WebView2 (viene con Windows).
"@ | Set-Content (Join-Path $dest "LEEME.txt") -Encoding UTF8

$size = (Get-ChildItem $dest -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Host ""
Write-Host "Listo: $dest"
Write-Host ("Tamaño: {0:N1} MB" -f ($size / 1MB))
if (-not $Copiar) {
    Write-Host "Los vídeos están enlazados: para llevar la carpeta a otro equipo usa -Copiar."
}
