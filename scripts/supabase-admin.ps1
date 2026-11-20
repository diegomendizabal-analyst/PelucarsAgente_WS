param([ValidateSet('Inspect', 'Apply', 'Test', 'Advisors', 'ContactStatus', 'TestInventory', 'InventoryStatus')][string]$Action = 'Inspect')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$tokenPath = Join-Path $taskRoot '.env.supabase.local'
$appEnvPath = Join-Path $taskRoot 'frontend/.env.local'
function Read-LocalValue([string]$Path, [string]$Name) {
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match ('^' + [regex]::Escape($Name) + '=') } | Select-Object -First 1
  if (-not $line) { return '' }
  return ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}
$token = Read-LocalValue $tokenPath 'SUPABASE_ACCESS_TOKEN'
if (-not $token) { throw 'Completar SUPABASE_ACCESS_TOKEN en .env.supabase.local, sin compartirlo.' }
$projectUrl = [uri](Read-LocalValue $appEnvPath 'NEXT_PUBLIC_SUPABASE_URL')
if ($projectUrl.Host -notmatch '^([a-z]{20})\.supabase\.co$') { throw 'URL de proyecto no válida.' }
$projectRef = $Matches[1]
$previousToken = $env:SUPABASE_ACCESS_TOKEN
try {
  $env:SUPABASE_ACCESS_TOKEN = $token
  Push-Location $taskRoot
  if ($Action -eq 'Inspect') {
    npx.cmd --yes supabase@3.2.0 db query "select table_name from information_schema.tables where table_schema = 'public' order by table_name" --remote=$projectRef --read-only
  } elseif ($Action -eq 'ContactStatus') {
    npx.cmd --yes supabase@3.2.0 db query "select count(*) as total_profiles, count(*) filter (where role = 'seller' and (contact_phone is null or contact_email is null)) as sellers_pending_contact, (select convalidated from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'seller_contact_required') as legacy_contacts_validated from public.profiles" --remote=$projectRef --read-only
  } elseif ($Action -eq 'TestInventory') {
    npx.cmd --yes supabase@3.2.0 db query --file supabase/tests/inventory.sql --remote=$projectRef --yes
  } elseif ($Action -eq 'InventoryStatus') {
    npx.cmd --yes supabase@3.2.0 db query "select (select count(*) from public.vehicles) as vehicles, (select count(*) from public.inventory_units) as units, (select count(*) from public.inventory_events) as events" --remote=$projectRef --read-only
  } elseif ($Action -eq 'Apply') {
    npx.cmd --yes supabase@3.2.0 db push --remote=$projectRef --skip-vault --dry-run
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo revisar la migración.' }
    npx.cmd --yes supabase@3.2.0 db push --remote=$projectRef --skip-vault --yes
  } elseif ($Action -eq 'Test') {
    npx.cmd --yes supabase@3.2.0 db query --file supabase/tests/identity.sql --remote=$projectRef --yes
  } else {
    npx.cmd --yes supabase@3.2.0 db advisors --remote=$projectRef
  }
  if ($LASTEXITCODE -ne 0) { throw 'La operación de Supabase no se completó.' }
} finally {
  Pop-Location
  $env:SUPABASE_ACCESS_TOKEN = $previousToken
  $token = $null
}
