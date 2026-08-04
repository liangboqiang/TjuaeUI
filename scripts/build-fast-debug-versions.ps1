param(
  [string[]]$Versions = @(),
  [string]$OutputDir = (Join-Path $PSScriptRoot '..\out-fast-builds')
)

$ErrorActionPreference = 'Stop'

function Get-PackageVersion([string]$RepoRoot) {
  $packageJsonPath = Join-Path $RepoRoot 'package.json'
  $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
  if (-not $packageJson.version) {
    throw "package.json 缺少 version 字段：$packageJsonPath"
  }
  return [string]$packageJson.version
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$env:ELECTRON_BUILDER_COMPRESSION_LEVEL = '1'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$buildVersions = @($Versions | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($buildVersions.Count -eq 0) {
  $buildVersions = @(Get-PackageVersion $repoRoot)
}

foreach ($version in $buildVersions) {
  Write-Host "=== 开始构建 $version：$(Get-Date -Format o) ==="
  $env:TJUAEUI_DEBUG_AUTO_UPDATE_CURRENT_VERSION = $version

  Push-Location $repoRoot
  try {
    bun run build-win:x64:fast
    if ($LASTEXITCODE -ne 0) {
      throw "构建 $version 失败，退出码：$LASTEXITCODE"
    }

    $source = Join-Path $repoRoot "out\TjuaeUI-$version-win-x64.exe"
    $target = Join-Path $OutputDir "TjuaeUI-$version-win-x64.exe"
    if (-not (Test-Path -LiteralPath $source)) {
      throw "未生成预期构件：$source"
    }

    Copy-Item -LiteralPath $source -Destination $target -Force
    $item = Get-Item -LiteralPath $target
    $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA512).Hash
    Write-Host "=== 构建 $version 完成：$(Get-Date -Format o) 大小=$($item.Length) sha512=$hash ==="
  } finally {
    Pop-Location
  }
}
