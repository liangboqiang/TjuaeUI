param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir,

  [Parameter(Mandatory = $true)]
  [ValidateSet('win32-x64', 'win32-arm64')]
  [string]$RuntimeKey,

  [Parameter(Mandatory = $true)]
  [string]$LogPath
)

$ErrorActionPreference = 'SilentlyContinue'

function Write-VerifyLog {
  param([string]$Message)
  $payload = [ordered]@{
    schemaVersion = 1
    ts = (Get-Date -Format o)
    session = ''
    version = ''
    arch = $RuntimeKey
    updated = $false
    instDir = $InstallDir
    event = 'verify-bundled-tjuaecore'
    message = $Message
  }
  Add-Content -LiteralPath $LogPath -Encoding UTF8 -Value ($payload | ConvertTo-Json -Compress -Depth 8)
}

function ConvertTo-RelativeResourcePath {
  param([string]$Path)
  $resourcesRoot = Join-Path $InstallDir 'resources'
  if ($Path.StartsWith($resourcesRoot, [System.StringComparison]::CurrentCultureIgnoreCase)) {
    return $Path.Substring($resourcesRoot.Length).TrimStart('\').Replace('\', '/')
  }
  return $Path.Replace('\', '/')
}

function New-Failure {
  param(
    [string]$Category,
    [string]$Component,
    [string]$Version,
    [string]$Path,
    [string]$Reason
  )

  [PSCustomObject]@{
    category  = $Category
    component = $Component
    version   = $Version
    platform  = $RuntimeKey
    path      = ConvertTo-RelativeResourcePath $Path
    reason    = $Reason
  }
}

function Test-NonEmptyFile {
  param(
    [System.Collections.Generic.List[object]]$Failures,
    [string]$Component,
    [string]$Version,
    [string]$Path,
    [bool]$Executable = $false,
    [string]$ComponentRoot = ''
  )

  $item = Get-Item -LiteralPath $Path -ErrorAction SilentlyContinue
  if (-not $item -or $item.PSIsContainer) {
    $category = 'publish_or_install_missing'
    if ($Executable -and $ComponentRoot -and (Test-Path -LiteralPath $ComponentRoot)) {
      $category = 'possible_security_quarantine'
    }
    $Failures.Add((New-Failure $category $Component $Version $Path 'missing_file')) | Out-Null
    return $false
  }

  if ($item.Length -le 0) {
    $Failures.Add((New-Failure 'publish_or_install_missing' $Component $Version $Path 'empty_file')) | Out-Null
    return $false
  }

  return $true
}

function Test-Directory {
  param(
    [System.Collections.Generic.List[object]]$Failures,
    [string]$Component,
    [string]$Version,
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    $Failures.Add((New-Failure 'publish_or_install_missing' $Component $Version $Path 'missing_directory')) | Out-Null
    return $false
  }

  return $true
}

function Read-JsonFile {
  param([string]$Path)
  try {
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Test-ContractRelativePath {
  param([object]$Value)
  if (-not ($Value -is [string]) -or -not $Value) {
    return $false
  }
  if ($Value.Contains('\') -or [System.IO.Path]::IsPathRooted($Value)) {
    return $false
  }
  foreach ($segment in $Value.Split('/')) {
    if (-not $segment -or $segment -eq '.' -or $segment -eq '..') {
      return $false
    }
  }
  return $true
}

function Join-ContractPath {
  param(
    [string]$Root,
    [string]$RelativePath
  )
  $current = $Root
  foreach ($segment in $RelativePath.Split('/')) {
    $current = Join-Path $current $segment
  }
  return $current
}

function Read-ManagedResourcesContract {
  param(
    [System.Collections.Generic.List[object]]$Failures,
    [string]$ManifestPath
  )

  if (-not (Test-NonEmptyFile $Failures 'managed-resources' '' $ManifestPath $false (Split-Path -Parent $ManifestPath))) {
    return $null
  }

  $contract = Read-JsonFile $ManifestPath
  if (-not $contract) {
    $Failures.Add((New-Failure 'publish_or_install_missing' 'managed-resources' '' $ManifestPath 'invalid_json')) | Out-Null
    return $null
  }
  return $contract
}

function Test-StringField {
  param(
    [object]$Object,
    [string]$Name
  )
  $value = $Object.$Name
  return ($value -is [string]) -and $value.Length -gt 0
}

function Test-NumberField {
  param(
    [object]$Object,
    [string]$Name
  )
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $false
  }

  $value = $property.Value
  if ($null -eq $value -or $value -is [string] -or $value -is [bool]) {
    return $false
  }

  return ($value -is [byte]) -or
    ($value -is [sbyte]) -or
    ($value -is [int16]) -or
    ($value -is [uint16]) -or
    ($value -is [int]) -or
    ($value -is [uint32]) -or
    ($value -is [long]) -or
    ($value -is [uint64]) -or
    ($value -is [single]) -or
    ($value -is [double]) -or
    ($value -is [decimal])
}

function Test-ManagedNodeContract {
  param(
    [System.Collections.Generic.List[object]]$Failures,
    [string]$ManagedRoot,
    [object]$Node
  )

  if (-not $Node -or -not (Test-StringField $Node 'version') -or -not (Test-StringField $Node 'root') -or -not (Test-StringField $Node 'executable')) {
    $Failures.Add((New-Failure 'publish_or_install_missing' 'node' '' $ManagedRoot 'invalid_schema')) | Out-Null
    return
  }
  if (-not (Test-ContractRelativePath $Node.root) -or -not (Test-ContractRelativePath $Node.executable)) {
    $Failures.Add((New-Failure 'publish_or_install_missing' 'node' $Node.version $ManagedRoot 'invalid_contract_path')) | Out-Null
    return
  }

  $nodeRoot = Join-ContractPath $ManagedRoot $Node.root
  Test-NonEmptyFile $Failures 'node' $Node.version (Join-ContractPath $nodeRoot $Node.executable) $true $nodeRoot | Out-Null
}

function Test-ManagedResourcesContract {
  param(
    [System.Collections.Generic.List[object]]$Failures,
    [string]$ManagedRoot
  )

  $contractPath = Join-Path $managedRoot 'manifest.json'
  $contract = Read-ManagedResourcesContract $Failures $contractPath
  if (-not $contract) {
    return
  }

  if (-not (Test-NumberField $contract 'schemaVersion')) {
    $Failures.Add((New-Failure 'publish_or_install_missing' 'managed-resources' '' $contractPath 'invalid_schema')) | Out-Null
    return
  }
  if ([double]$contract.schemaVersion -ne 3) {
    $Failures.Add((New-Failure 'publish_or_install_missing' 'managed-resources' '' $contractPath 'unsupported_schema_version')) | Out-Null
    return
  }
  if ($contract.runtimeKey -ne $RuntimeKey) {
    $Failures.Add((New-Failure 'publish_or_install_missing' 'managed-resources' '' $contractPath 'runtime_key_mismatch')) | Out-Null
    return
  }

  $contractKeys = @($contract.PSObject.Properties.Name | Sort-Object)
  if (($contractKeys -join ',') -ne 'node,runtimeKey,schemaVersion') {
    $Failures.Add((New-Failure 'publish_or_install_missing' 'managed-resources' '' $contractPath 'invalid_schema')) | Out-Null
    return
  }

  Test-ManagedNodeContract $Failures $ManagedRoot $contract.node
  $forbiddenCliRoot = Join-Path $ManagedRoot 'cli'
  if (Test-Path -LiteralPath $forbiddenCliRoot) {
    $Failures.Add((New-Failure 'publish_or_install_missing' 'third-party-cli' '' $forbiddenCliRoot 'forbidden_bundled_dependency')) | Out-Null
  }
}

function Test-BundledResourcesOnce {
  $failures = [System.Collections.Generic.List[object]]::new()
  $runtimeParts = $RuntimeKey.Split('-', 2)
  $expectedPlatform = $runtimeParts[0]
  $expectedArch = $runtimeParts[1]
  $resourcesDir = Join-Path $InstallDir 'resources'
  $baseDir = Join-Path $resourcesDir "bundled-tjuaecore\$RuntimeKey"

  if (-not (Test-Directory $failures 'tjuaecore' '' $baseDir)) {
    return $failures
  }

  Test-NonEmptyFile $failures 'tjuaecore' '' (Join-Path $baseDir 'tjuaecore.exe') $true $baseDir | Out-Null

  $bundleManifestPath = Join-Path $baseDir 'manifest.json'
  if (Test-NonEmptyFile $failures 'tjuaecore-manifest' '' $bundleManifestPath $false $baseDir) {
    $bundleManifest = Read-JsonFile $bundleManifestPath
    if (-not $bundleManifest) {
      $failures.Add((New-Failure 'publish_or_install_missing' 'tjuaecore-manifest' '' $bundleManifestPath 'invalid_json')) | Out-Null
    } else {
      if ($bundleManifest.platform -ne $expectedPlatform) {
        $failures.Add((New-Failure 'publish_or_install_missing' 'tjuaecore-manifest' '' $bundleManifestPath "platform_mismatch:$($bundleManifest.platform)")) | Out-Null
      }
      if ($bundleManifest.arch -ne $expectedArch) {
        $failures.Add((New-Failure 'publish_or_install_missing' 'tjuaecore-manifest' '' $bundleManifestPath "arch_mismatch:$($bundleManifest.arch)")) | Out-Null
      }
    }
  }

  $managedRoot = Join-Path $baseDir 'managed-resources'
  if (Test-Directory $failures 'managed-resources' '' $managedRoot) {
    Test-ManagedResourcesContract $failures $managedRoot
  }

  return $failures
}

for ($attempt = 1; $attempt -le 5; $attempt++) {
  $failures = @(Test-BundledResourcesOnce)
  if ($failures.Count -eq 0) {
    Write-VerifyLog "verify-bundled-tjuaecore result=ok runtime=$RuntimeKey attempts=$attempt"
    exit 0
  }

  $summary = ($failures | ConvertTo-Json -Compress -Depth 5)
  if ($attempt -lt 5) {
    Write-VerifyLog "verify-bundled-tjuaecore result=retry classification=resource_pending_landing runtime=$RuntimeKey attempt=$attempt failures=$summary"
    Start-Sleep -Milliseconds 500
  } else {
    Write-VerifyLog "verify-bundled-tjuaecore result=fail runtime=$RuntimeKey failures=$summary"
  }
}

exit 1
