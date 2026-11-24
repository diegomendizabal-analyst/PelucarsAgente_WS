param([ValidateSet('Inspect','Fingerprint','Plan','Apply','LoadDemo','Status')][string]$Action='Inspect')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
function Read-LocalValue([string]$Path,[string]$Name) {
  $line=Get-Content -LiteralPath $Path | Where-Object { $_ -match ('^'+[regex]::Escape($Name)+'=') } | Select-Object -First 1
  if (-not $line) { return '' }
  return ($line -split '=',2)[1].Trim().Trim('"').Trim("'")
}
$token=Read-LocalValue (Join-Path $taskRoot '.env.supabase.local') 'SUPABASE_ACCESS_TOKEN'
$projectUrl=[uri](Read-LocalValue (Join-Path $taskRoot 'frontend/.env.local') 'NEXT_PUBLIC_SUPABASE_URL')
if (-not $token -or $projectUrl.Host -notmatch '^([a-z]{20})\.supabase\.co$') { throw 'Falta configuración local válida.' }
$projectRef=$Matches[1]
$previousToken=$env:SUPABASE_ACCESS_TOKEN
try {
 $env:SUPABASE_ACCESS_TOKEN=$token
 Push-Location $taskRoot
 if($Action -eq 'Inspect') {
  npx.cmd --yes supabase@3.2.0 db query "select jsonb_build_object('migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),'leads_by_source',(select jsonb_agg(t) from (select source,count(*) from public.leads group by source)t),'enabled_admins',(select count(*) from public.profiles where is_enabled and role='admin'),'enabled_sellers',(select count(*) from public.profiles where is_enabled and role='seller')) as inspection" --remote=$projectRef --read-only
 } elseif($Action -eq 'Fingerprint') {
  $existingLeads="(select md5('pelucars-reports-demo-20261124-lead-'||i)::uuid from generate_series(1,24)i)"
  $existingVehicles="(select md5('pelucars-reports-demo-20261124-vehicle-'||i)::uuid from generate_series(1,4)i)"
  $parts=@()
  foreach($table in @('profiles','leads','customers','vehicles','inventory_units','inventory_events','lead_assignments','lead_status_history','lead_notifications')) {
   $where=switch($table) {
    'profiles' { 'true' }
    'leads' { "id not in $existingLeads" }
    'customers' { "id not in (select md5('pelucars-reports-demo-20261124-customer-'||i)::uuid from generate_series(1,24)i)" }
    'vehicles' { "id not in $existingVehicles" }
    {$_ -in 'inventory_units','inventory_events'} { "vehicle_id not in $existingVehicles" }
    default { "lead_id not in $existingLeads" }
   }
   $parts+="'$table',(select md5(coalesce(jsonb_agg(to_jsonb(t)-'source' order by id)::text,'[]')) from public.$table t where $where)"
  }
  $query='select jsonb_build_object('+($parts -join ',')+') as fingerprints'
  npx.cmd --yes supabase@3.2.0 db query $query --remote=$projectRef --read-only
 } elseif($Action -in @('Plan','Apply')) {
  $ErrorActionPreference='Continue'
  $plan=npx.cmd --yes supabase@3.2.0 db push --remote=$projectRef --skip-vault --dry-run 2>&1
  $planExit=$LASTEXITCODE
  $ErrorActionPreference='Stop'
  if($planExit -ne 0) { $plan | Write-Output; throw 'No se pudo revisar el plan de migraciones.' }
  $plan | Write-Output
  $names=[regex]::Matches(($plan -join "`n"),'20\d{12}_[a-z_]+\.sql') | ForEach-Object { $_.Value } | Select-Object -Unique
  $allowed=@('20261124125922_admin_reports.sql','20261124132709_inventory_year_ranges.sql','20261124132919_demo_data_isolation.sql','20261124145350_inventory_budget_conversion.sql')
  if(@($names | Where-Object { $_ -notin $allowed }).Count -gt 0) { throw 'El plan contiene migraciones ajenas al incremento; no se aplica.' }
  if($Action -eq 'Apply' -and @($names).Count -gt 0) {
   npx.cmd --yes supabase@3.2.0 db push --remote=$projectRef --skip-vault --yes
  }
 } elseif($Action -eq 'LoadDemo') {
  npx.cmd --yes supabase@3.2.0 db query --file supabase/demo/reports.sql --remote=$projectRef --yes
 } else {
  npx.cmd --yes supabase@3.2.0 db query "select jsonb_build_object('leads',(select jsonb_object_agg(source,n) from (select source,count(*) n from public.leads group by source)t),'vehicles',(select jsonb_object_agg(source,n) from (select source,count(*) n from public.vehicles group by source)t),'demo_units',(select count(*) from public.inventory_units u join public.vehicles v on v.id=u.vehicle_id where v.source='demo'),'report_rpc',to_regprocedure('public.get_admin_report(date,date,uuid,text)') is not null) as status" --remote=$projectRef --read-only
 }
 if($LASTEXITCODE -ne 0) { throw 'Operación incompleta.' }
} finally { Pop-Location; $env:SUPABASE_ACCESS_TOKEN=$previousToken; $token=$null }
