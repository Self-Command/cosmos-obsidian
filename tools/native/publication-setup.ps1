$ErrorActionPreference='Stop'
if(!$env:PUBLICATION_TOKEN){throw 'Real isolated publication requires PUBLICATION_TOKEN; this job cannot skip.'}
$vault=Join-Path $env:COSMOS_NATIVE_ROOT 'Cosmos Acceptance'
$plugin=Join-Path $vault '.obsidian/plugins/obsidian-mkdocs-publisher'
New-Item -ItemType Directory -Force -Path $plugin | Out-Null
foreach($asset in @('main.js','manifest.json','styles.css')){Invoke-WebRequest -Uri "https://github.com/Enveloppe/obsidian-enveloppe/releases/download/7.8.2/$asset" -OutFile (Join-Path $plugin $asset)}
$bridge=[IO.File]::ReadAllText('tests/fixtures/model-v3/services/enveloppe-amytis-bridge.cjs')
$mapping=[IO.File]::ReadAllText('tools/native/publication-bridge.cjs')
$official=[IO.File]::ReadAllText((Join-Path $plugin 'main.js'))
[IO.File]::WriteAllText((Join-Path $plugin 'main.js'),$official+"`n"+$bridge+"`n"+$mapping,[Text.UTF8Encoding]::new($false))
$fingerprint=(Get-FileHash -LiteralPath (Join-Path $plugin 'main.js') -Algorithm SHA256).Hash.ToLower()
New-Item -ItemType Directory -Force -Path (Join-Path $vault '宇宙/演化/变更') | Out-Null
@{patchedFingerprint=$fingerprint}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $vault '宇宙/演化/变更/amytis-implementation.json') -Encoding utf8NoBOM
$contract=Get-Content -LiteralPath 'tests/fixtures/model-v3/services/publish-contract.json' -Raw | ConvertFrom-Json -AsHashtable
# Exact source config changes only for the synthetic fixture. All renderer source blob checks stay real.
$contract.sourceBlobs['site.config.ts']='a047d5732bbe9c791626165d880d2b298474d56e'
$settings=@{github=@{user='Self-Command';repo='amytis';branch='main';automaticallyMergePR=$true;verifiedRepo=$true;tokenSecret='cosmos-publication-fixture';otherRepo=@();dryRun=@{enable=$false;folderName='enveloppe'};api=@{tiersForApi='Github Free/Pro/Team (default)';hostname=''};workflow=@{commitMessage='Synthetic';name='deploy.yml'};rateLimit=0};upload=@{};embed=@{};conversion=@{};plugin=@{}}
foreach($rule in $contract.settings){$keys=$rule.pointer.TrimStart('/').Split('/');$cursor=$settings;foreach($key in $keys[0..($keys.Length-2)]){if(!$cursor.ContainsKey($key)){$cursor[$key]=@{}};$cursor=$cursor[$key]};$cursor[$keys[-1]]=$rule.value}
$settings|ConvertTo-Json -Depth 20|Set-Content -LiteralPath (Join-Path $plugin 'data.json') -Encoding utf8NoBOM
foreach($module in @('publish-adapter.cjs','publish-service.cjs','publish-transport.cjs')){Copy-Item -LiteralPath (Join-Path 'tests/fixtures/model-v3/services' $module) -Destination (Join-Path $vault ('宇宙/演化/脚本/lib/'+$module))}
$contract|ConvertTo-Json -Depth 20|Set-Content -LiteralPath (Join-Path $vault '宇宙/演化/脚本/lib/publish-contract.json') -Encoding utf8NoBOM
New-Item -ItemType Directory -Force -Path (Join-Path $vault '星云/星尘/附件/图片') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $vault '太阳/光球/文章') | Out-Null
