# Grava HF_CREDENTIALS no .dev.vars sem mostrar a chave na tela.
# Uso: & .\scripts\set-hf-key.ps1   (cole a chave e aperte Enter; nada aparece enquanto cola)

$file = Join-Path $PSScriptRoot '..\.dev.vars'
$secure = Read-Host 'Cole a chave da Higgsfield (id:secret) e aperte Enter' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim().Trim('"')
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ($key -notmatch '^[^:\s]+:[^:\s]+$') {
    Write-Host 'Formato invalido: esperado id:secret (um unico ":" e sem espacos). Nada foi gravado.' -ForegroundColor Red
    $key = $null
    exit 1
}

$lines = @()
if (Test-Path $file) { $lines = @(Get-Content $file | Where-Object { $_ -notmatch '^\s*HF_CREDENTIALS\s*=' }) }
$lines = @("HF_CREDENTIALS=$key") + $lines
[IO.File]::WriteAllLines((Resolve-Path -LiteralPath (Split-Path $file)).Path + '\.dev.vars', $lines)
$key = $null

Write-Host 'OK: HF_CREDENTIALS gravada no .dev.vars (o valor nao foi exibido).' -ForegroundColor Green
