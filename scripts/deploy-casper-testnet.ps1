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
  [long]$PaymentAmount = 30000000000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-CommandAvailable {
  param([Parameter(Mandatory = $true)][string]$Name)
  if ($null -eq (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required before deploying to Casper Testnet. Install it and rerun this script."
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resolvedWasmPath = Resolve-Path -Path (Join-Path $repoRoot $WasmPath) -ErrorAction SilentlyContinue
$resolvedSecretKeyPath = Resolve-Path -Path $SecretKeyPath -ErrorAction SilentlyContinue

Assert-CommandAvailable -Name "cargo"
Assert-CommandAvailable -Name "casper-client"

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

Write-Host "Submitting risk-report-registry to Casper Testnet..."
Write-Host "Node: $NodeAddress"
Write-Host "Chain: $ChainName"
Write-Host "Wasm: $resolvedWasmPath"

casper-client put-deploy `
  --node-address $NodeAddress `
  --chain-name $ChainName `
  --secret-key $resolvedSecretKeyPath `
  --payment-amount $PaymentAmount `
  --session-path $resolvedWasmPath
