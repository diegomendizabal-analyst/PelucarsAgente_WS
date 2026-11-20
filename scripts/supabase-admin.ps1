param([ValidateSet('Inspect', 'Apply', 'Test', 'Advisors', 'ContactStatus', 'TestInventory', 'InventoryStatus', 'TestCrm', 'TestCrmRecurrence', 'TestCrmSeed', 'CrmStatus', 'LoadCrmDemo', 'ResetCrmDemo', 'CrmDemoStatus')][string]$Action = 'Inspect')
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
  } elseif ($Action -eq 'TestCrm') {
    npx.cmd --yes supabase@3.2.0 db query --file supabase/tests/crm.sql --remote=$projectRef --yes
  } elseif ($Action -eq 'LoadCrmDemo') {
    npx.cmd --yes supabase@3.2.0 db query --file supabase/demo/crm.sql --remote=$projectRef --yes
  } elseif ($Action -eq 'TestCrmRecurrence') {
    npx.cmd --yes supabase@3.2.0 db query --file supabase/tests/crm-recurrence.sql --remote=$projectRef --yes
  } elseif ($Action -in @('ResetCrmDemo','TestCrmSeed')) {
    $demoSql = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $taskRoot 'supabase/demo/crm.sql')
    if (-not $demoSql.Contains('-- RESET_MODE')) { throw 'Falta el marcador de reinicio del seed.' }
    $demoResetPath = Join-Path $taskRoot '.pr-work/crm-demo-reset.sql'
    New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot '.pr-work') | Out-Null
    try {
      if ($Action -eq 'TestCrmSeed') {
        $demoBody = [regex]::Replace($demoSql, '(?m)^(begin;|commit;)\r?\n?', '')
        $testBefore = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $taskRoot 'supabase/tests/crm-seed-before.sql')
        $testAfter = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $taskRoot 'supabase/tests/crm-seed-after.sql')
        $resetBody = $demoBody.Replace('-- RESET_MODE', "select set_config('pelucars.reset_crm_demo','on',true);")
        $keepBody = $demoBody.Replace('-- RESET_MODE', "select set_config('pelucars.reset_crm_demo','off',true);")
        ($testBefore + "`n" + $resetBody + "`n" + $testAfter + "`n" + $keepBody + "`ndo `$`$ begin if (select count(*) from public.leads where source='demo') <> 7 then raise exception 'Seed duplicado'; end if; if exists(select 1 from demo_seed_snapshot s where s.data is distinct from (select to_jsonb(l) from public.leads l where l.id=s.id)) then raise exception 'Carga altera muestra existente'; end if; end `$`$;`nrollback;`nselect 'OK: reset acotado, recurrencia, avisos e idempotencia del seed; rollback completo' as result;") | Set-Content -LiteralPath $demoResetPath -Encoding UTF8
      } else {
        $demoSql.Replace('-- RESET_MODE', "select set_config('pelucars.reset_crm_demo','on',true);") | Set-Content -LiteralPath $demoResetPath -Encoding UTF8
      }
      npx.cmd --yes supabase@3.2.0 db query --file $demoResetPath --remote=$projectRef --yes
    } finally { Remove-Item -LiteralPath $demoResetPath -ErrorAction SilentlyContinue }
  } elseif ($Action -eq 'CrmDemoStatus') {
    npx.cmd --yes supabase@3.2.0 db query "select l.id, l.reference_number, c.full_name as customer, l.source, l.commercial_status, coalesce(p.full_name,'Sin asignar') as responsible, (select count(*) from public.lead_interests i where i.lead_id=l.id) as interests, (select count(*) from public.lead_notifications n where n.lead_id=l.id and n.read_at is null) as unread_notifications, (select count(*) from public.lead_timeline t where t.lead_id=l.id) as events from public.leads l join public.customers c on c.id=l.customer_id left join public.profiles p on p.id=l.assigned_to where l.source='demo' order by l.id" --remote=$projectRef --read-only
  } elseif ($Action -eq 'CrmStatus') {
    npx.cmd --yes supabase@3.2.0 db query "select (select count(*) from public.customers) as customers, (select count(*) from public.leads) as leads, (select count(*) from public.lead_interests) as interests, (select count(*) from public.lead_assignments) as assignments, (select count(*) from public.lead_status_history) as status_events" --remote=$projectRef --read-only
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
