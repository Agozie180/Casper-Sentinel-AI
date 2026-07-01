param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$SecretKeyPath,

  [ValidateNotNullOrEmpty()]
  [string]$NodeAddress = "https://node.testnet.casper.network/rpc",

  [ValidateNotNullOrEmpty()]
  [string]$ChainName = "casper-test",

  [ValidateNotNullOrEmpty()]
  [string]$WasmPath = "target/wasm32-unknown-unknown/release/risk_report_registry.wasm",

  [ValidateRange(1, [long]::MaxValue)]
  [long]$PaymentAmount = 30000000000,

  [ValidateNotNullOrEmpty()]
  [string]$WslDistribution = "Ubuntu"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-CommandAvailable {
  param([Parameter(Mandatory = $true)][string]$Name)
  if ($null -eq (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required before deploying to Casper Testnet. Install it and rerun this script."
  }
}

function Test-WslCasperClientAvailable {
  param([Parameter(Mandatory = $true)][string]$Distribution)
  if ($null -eq (Get-Command "wsl.exe" -ErrorAction SilentlyContinue)) {
    return $false
  }

  $output = & wsl.exe -d $Distribution -- bash -lc "command -v casper-client >/dev/null 2>&1 && casper-client --version" 2>$null
  return $LASTEXITCODE -eq 0 -and $output -match "Casper client"
}

function Convert-ToWslPath {
  param(
    [Parameter(Mandatory = $true)][string]$Distribution,
    [Parameter(Mandatory = $true)][string]$WindowsPath
  )

  $converted = & wsl.exe -d $Distribution -- wslpath -a $WindowsPath
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($converted)) {
    throw "Could not convert Windows path for WSL: $WindowsPath"
  }
  return $converted.Trim()
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resolvedWasmPath = Resolve-Path -Path (Join-Path $repoRoot $WasmPath) -ErrorAction SilentlyContinue
$resolvedSecretKeyPath = Resolve-Path -Path $SecretKeyPath -ErrorAction SilentlyContinue

Assert-CommandAvailable -Name "cargo"

if ($null -eq $resolvedSecretKeyPath) {
  throw "Secret key path was not found. Provide a funded Casper Testnet deploy key path."
}

if ($null -eq $resolvedWasmPath) {
  Write-Host "Building contract Wasm artifact..."
  Push-Location $repoRoot
  try {
    cargo build -p risk-report-registry --target wasm32-unknown-unknown --release
  }
  finally {
    Pop-Location
  }
  $resolvedWasmPath = Resolve-Path -Path (Join-Path $repoRoot $WasmPath)
}

$nativeCasperClient = Get-Command "casper-client" -ErrorAction SilentlyContinue
$useWslCasperClient = $false
if ($null -eq $nativeCasperClient) {
  if (-not (Test-WslCasperClientAvailable -Distribution $WslDistribution)) {
    throw "casper-client is required before deploying to Casper Testnet. Install it natively or inside WSL distribution '$WslDistribution'."
  }
  $useWslCasperClient = $true
}

Write-Host "Submitting risk-report-registry to Casper Testnet..."
Write-Host "Node: $NodeAddress"
Write-Host "Chain: $ChainName"
Write-Host "Wasm: $resolvedWasmPath"
Write-Host "Client: $(if ($useWslCasperClient) { "WSL $WslDistribution" } else { "native" })"

if ($useWslCasperClient) {
  $wslWasmPath = Convert-ToWslPath -Distribution $WslDistribution -WindowsPath $resolvedWasmPath.Path
  $wslSecretKeyPath = Convert-ToWslPath -Distribution $WslDistribution -WindowsPath $resolvedSecretKeyPath.Path
  & wsl.exe -d $WslDistribution -- casper-client put-deploy `
    --node-address $NodeAddress `
    --chain-name $ChainName `
    --secret-key $wslSecretKeyPath `
    --payment-amount $PaymentAmount `
    --session-path $wslWasmPath
  exit $LASTEXITCODE
}

casper-client put-deploy `
  --node-address $NodeAddress `
  --chain-name $ChainName `
  --secret-key $resolvedSecretKeyPath `
  --payment-amount $PaymentAmount `
  --session-path $resolvedWasmPath
