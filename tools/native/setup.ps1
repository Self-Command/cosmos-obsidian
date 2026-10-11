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
'["tasknotes"]' | Set-Content -LiteralPath (Join-Path $nativeVault '.obsidian/community-plugins.json') -Encoding utf8NoBOM
foreach ($asset in @('main.js','manifest.json','styles.css')) {
  Invoke-WebRequest -Uri "https://github.com/callumalpass/tasknotes/releases/download/4.13.8/$asset" -OutFile (Join-Path $nativeVault ".obsidian/plugins/tasknotes/$asset")
}
# Synthetic task configuration only; no production plugin settings are copied.
@{tasksFolder='太阳/核聚变';taskTag='task';defaultTaskStatus='open';defaultTaskPriority='normal';taskNamingFormat='{{title}}';enableHttpApi=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $nativeVault '.obsidian/plugins/tasknotes/data.json') -Encoding utf8NoBOM
@{version=1;vaultPath=$nativeVault;vaultName='Cosmos Acceptance';cliPath=$cli;stateRoot=$nativeState;schemaPath='rules/schema.json';timeoutMs=20000} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $nativeRoot 'binding.json') -Encoding utf8NoBOM
"COSMOS_CONFIG=$(Join-Path $nativeRoot 'binding.json')" | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
"COSMOS_NATIVE_ROOT=$nativeRoot" | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
Start-Process -FilePath $exe -ArgumentList @('--disable-gpu','--no-sandbox') -WindowStyle Hidden | Out-Null
# Readiness is established by the runtime API probe in the next step, not an arbitrary sleep.
