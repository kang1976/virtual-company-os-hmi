# PLC 모니터링 - Windows 설치 프로그램(exe) 빌드 스크립트
#
# 하는 일:
#   1) dist-installer\app 폴더를 깨끗이 비우고, 실행에 필요한 파일만 새로 채운다
#      (포터블 node.exe + src/ + public/ + data/ + package.json + node_modules).
#   2) installer\run.vbs(더블클릭 실행용 런처)를 그 폴더에 같이 넣는다.
#   3) Inno Setup 컴파일러(ISCC.exe)로 installer\setup.iss를 컴파일해서
#      dist-installer\output\PLC-Monitoring-Setup.exe 를 만든다.
#
# 사용법: 프로젝트 루트에서 `powershell -File scripts\build-installer.ps1`

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $root 'dist-installer\app'
$iscc = Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'

if (-not (Test-Path $iscc)) {
    throw "Inno Setup 컴파일러(ISCC.exe)를 찾을 수 없습니다: $iscc `n(winget install JRSoftware.InnoSetup 로 설치하세요)"
}

Write-Host "[1/4] 이전 빌드 폴더 정리 중..."
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

Write-Host "[2/4] 포터블 node.exe 복사 중..."
$nodeExe = (Get-Command node -ErrorAction Stop).Source
Copy-Item $nodeExe (Join-Path $stage 'node.exe')

Write-Host "[3/4] 앱 파일 복사 중 (src/public/data/node_modules)..."
function Copy-Folder($name) {
    $src = Join-Path $root $name
    $dst = Join-Path $stage $name
    if (Test-Path $src) {
        robocopy $src $dst /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    }
}
Copy-Folder 'src'
Copy-Folder 'public'
Copy-Folder 'data'
Copy-Folder 'node_modules'
Copy-Item (Join-Path $root 'package.json') (Join-Path $stage 'package.json')
Copy-Item (Join-Path $root 'installer\run.vbs') (Join-Path $stage 'run.vbs')

Write-Host "[4/4] Inno Setup으로 설치 프로그램 컴파일 중..."
& $iscc (Join-Path $root 'installer\setup.iss')

Write-Host ""
Write-Host "완료: dist-installer\output\PLC-Monitoring-Setup.exe"
