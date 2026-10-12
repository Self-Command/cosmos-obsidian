$ErrorActionPreference = 'Stop'
$nativeRoot = Join-Path $env:RUNNER_TEMP 'cosmos-native'
$nativeApp = Join-Path $nativeRoot 'app'
$nativeVault = Join-Path $nativeRoot 'Cosmos Acceptance'
$nativeState = Join-Path $nativeRoot 'state'
New-Item -ItemType Directory -Force -Path $nativeRoot,$nativeVault,$nativeState | Out-Null
$installer = Join-Path $nativeRoot 'Obsidian-1.14.4.exe'
Invoke-WebRequest -Uri 'https://github.com/obsidianmd/obsidian-releases/releases/download/v1.14.4/Obsidian-1.14.4.exe' -OutFile $installer
$installProcess = Start-Process -FilePath $installer -ArgumentList @('/S',"/D=$nativeApp") -WindowStyle Hidden -PassThru -Wait
if ($installProcess.ExitCode -ne 0) { throw "Obsidian installation failed: $($installProcess.ExitCode)" }
$cli = Join-Path $nativeApp 'Obsidian.com'
$exe = Join-Path $nativeApp 'Obsidian.exe'
if (!(Test-Path -LiteralPath $cli) -or !(Test-Path -LiteralPath $exe)) { throw 'Official installer did not provide Obsidian CLI.' }
$obsidianData = Join-Path $env:APPDATA 'obsidian'
New-Item -ItemType Directory -Force -Path $obsidianData,(Join-Path $nativeVault '.obsidian/plugins/tasknotes') | Out-Null
@{cli=$true;updateDisabled=$true;vaults=@{cosmosacceptance=@{path=$nativeVault;ts=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();open=$true}}} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $obsidianData 'obsidian.json') -Encoding utf8NoBOM
@{restrictedMode=$false;promptDelete=$false;alwaysUpdateLinks=$true} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $nativeVault '.obsidian/app.json') -Encoding utf8NoBOM
'["tasknotes","periodic-notes"]' | Set-Content -LiteralPath (Join-Path $nativeVault '.obsidian/community-plugins.json') -Encoding utf8NoBOM
foreach ($asset in @('main.js','manifest.json','styles.css')) {
  Invoke-WebRequest -Uri "https://github.com/callumalpass/tasknotes/releases/download/4.13.8/$asset" -OutFile (Join-Path $nativeVault ".obsidian/plugins/tasknotes/$asset")
}
New-Item -ItemType Directory -Force -Path (Join-Path $nativeVault '.obsidian/plugins/periodic-notes') | Out-Null
foreach ($periodicAsset in @('main.js','manifest.json','styles.css')) { Invoke-WebRequest -Uri "https://github.com/liamcain/obsidian-periodic-notes/releases/download/0.0.17/$periodicAsset" -OutFile (Join-Path $nativeVault ".obsidian/plugins/periodic-notes/$periodicAsset") }
# Synthetic task configuration only; no production plugin settings are copied.
New-Item -ItemType Directory -Force -Path (Join-Path $nativeVault '太阳/核聚变'),(Join-Path $nativeVault 'rules'),(Join-Path $nativeVault 'templates') | Out-Null
@{version=3;common=@{};entities=@{task=@{folder='太阳/核聚变';folders=@('太阳/核聚变');allowSubfolders=$true}};actions=@();stageCategories=@{'太阳/核聚变'=@()}} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $nativeVault 'rules/schema.json') -Encoding utf8NoBOM
# Public, empty model contracts are the only vault fixtures. Native tests use the downloaded candidate.
Copy-Item -LiteralPath 'tests/fixtures/model-v3/schema.json' -Destination (Join-Path $nativeVault 'rules/schema.json')
foreach ($templateFile in Get-ChildItem -LiteralPath 'tests/fixtures/model-v3/templates' -File) { Copy-Item -LiteralPath $templateFile.FullName -Destination (Join-Path $nativeVault ('templates/'+$templateFile.Name)) }
$modelFixture=Get-Content -LiteralPath 'tests/fixtures/model-v3/schema.json' -Raw -Encoding UTF8 | ConvertFrom-Json -Depth 70
foreach ($entityProperty in $modelFixture.entities.PSObject.Properties) {
  foreach ($modelFolder in @($entityProperty.Value.folder)+@($entityProperty.Value.folders)) { New-Item -ItemType Directory -Force -Path (Join-Path $nativeVault $modelFolder) | Out-Null }
}
foreach($stageProperty in $modelFixture.stageCategories.PSObject.Properties){
  New-Item -ItemType Directory -Force -Path (Join-Path $nativeVault $stageProperty.Name) | Out-Null
  foreach($category in $stageProperty.Value){New-Item -ItemType Directory -Force -Path (Join-Path $nativeVault ($stageProperty.Name+'/'+$category)) | Out-Null}
}
New-Item -ItemType Directory -Force -Path (Join-Path $nativeVault ($modelFixture.scriptFolder+'/lib')) | Out-Null
Copy-Item -LiteralPath 'tests/fixtures/model-v3/services/system-engine.cjs' -Destination (Join-Path $nativeVault ($modelFixture.scriptFolder+'/lib/system-engine.cjs'))
foreach($archiveCategory in $modelFixture.archiveCategories.PSObject.Properties.Value) { New-Item -ItemType Directory -Force -Path (Join-Path $nativeVault ($modelFixture.archiveFolder+'/'+$archiveCategory)) | Out-Null }
$periodicSettings=@{showGettingStartedBanner=$false;hasMigratedDailyNoteSettings=$true;hasMigratedWeeklyNoteSettings=$true}
foreach($periodPair in @(@('daily','day'),@('weekly','week'),@('monthly','month'),@('quarterly','quarter'),@('yearly','year'))) {
  $definition=$modelFixture.periodTemplates.($periodPair[1])
  $periodicSettings[$periodPair[0]]=@{enabled=$true;format=$definition.format;folder=('地球/地层/'+$definition.name);template=('templates/'+$definition.name+'.md')}
}
$periodicSettings | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $nativeVault '.obsidian/plugins/periodic-notes/data.json') -Encoding utf8NoBOM
@'
---
type: task
project: []
area: ""
source: manual
format: note
publish: false
tags: []
route: "太阳/核聚变"
---

# {{title}}

## 任务说明

{{details}}
'@ | Set-Content -LiteralPath (Join-Path $nativeVault 'templates/任务.md') -Encoding utf8NoBOM
@{tasksFolder='太阳/核聚变';taskFilenameFormat='title';storeTitleInFilename=$true;taskIdentificationMethod='property';taskPropertyName='type';taskPropertyValue='task';defaultTaskStatus='open';defaultTaskPriority='normal';fieldMapping=@{projects='project';dateCreated='created';dateModified='updated'};taskCreationDefaults=@{useBodyTemplate=$true;bodyTemplate='templates/任务.md';defaultRecurrence='none';defaultDueDate='none';defaultScheduledDate='none'};enableHttpApi=$false} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $nativeVault '.obsidian/plugins/tasknotes/data.json') -Encoding utf8NoBOM
@{version=1;vaultPath=$nativeVault;vaultName='Cosmos Acceptance';cliPath=$cli;stateRoot=$nativeState;schemaPath='rules/schema.json';templateFolder='templates';timeoutMs=30000} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $nativeRoot 'binding.json') -Encoding utf8NoBOM
"COSMOS_CONFIG=$(Join-Path $nativeRoot 'binding.json')" | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
"COSMOS_NATIVE_ROOT=$nativeRoot" | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
Start-Process -FilePath $exe -ArgumentList @('--disable-gpu','--no-sandbox') -WindowStyle Hidden | Out-Null
# Readiness is established by the runtime API probe in the next step, not an arbitrary sleep.
