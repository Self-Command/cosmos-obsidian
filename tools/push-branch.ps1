param([string]$Repository='Self-Command/cosmos-obsidian',[string]$Branch='codex/independent-runtime')
$ErrorActionPreference='Stop'
if ($Repository -ne 'Self-Command/cosmos-obsidian' -or $Branch -notlike 'codex/*') { throw 'This helper only publishes the independent project development branch.' }
if (@(git status --porcelain).Count) { throw 'Commit the intended tree before publishing.' }
$localCommit=git rev-parse HEAD
$remoteCommit=gh api "repos/$Repository/git/ref/heads/$Branch" --jq '.object.sha'
if ($LASTEXITCODE -ne 0 -or $remoteCommit -ne (git rev-parse HEAD^)) { throw 'Remote parent differs; inspect history before publishing.' }
$baseTree=gh api "repos/$Repository/git/commits/$remoteCommit" --jq '.tree.sha'
$entries=@()
foreach ($file in @(git -c core.quotepath=false diff --name-only $remoteCommit HEAD)) {
  if (!(Test-Path -LiteralPath $file)) { $entries+=@{path=$file;mode='100644';type='blob';sha=$null};continue }
  if ((git hash-object -- $file) -ne (git rev-parse "HEAD:$file")) { throw "Working file differs from committed bytes: $file" }
  # Publish exact Git bytes, including canonical line endings and the final newline.
  $blobFile=Join-Path $env:TEMP ('cosmos-blob-'+[guid]::NewGuid()+'.txt')
  try {
    git cat-file blob "HEAD:$file" > $blobFile
    if ($LASTEXITCODE -ne 0 -or (git hash-object --no-filters -- $blobFile) -ne (git rev-parse "HEAD:$file")) { throw "Cannot read exact committed blob: $file" }
    $entries+=@{path=$file;mode='100644';type='blob';content=[IO.File]::ReadAllText($blobFile)}
  } finally { Remove-Item -LiteralPath $blobFile -ErrorAction SilentlyContinue }
}
$inputFile=Join-Path $env:TEMP ('cosmos-api-'+[guid]::NewGuid()+'.json')
try {
  @{base_tree=$baseTree;tree=$entries}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $inputFile -Encoding utf8NoBOM
  $tree=gh api --method POST "repos/$Repository/git/trees" --input $inputFile --jq '.sha'
  if ($LASTEXITCODE -ne 0 -or $tree -ne (git rev-parse 'HEAD^{tree}')) { throw 'Published tree does not match committed source.' }
  $utcDate=[DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
  $author=@{name=(git show -s --format='%an' HEAD);email=(git show -s --format='%ae' HEAD);date=$utcDate}
  $committer=@{name=(git show -s --format='%cn' HEAD);email=(git show -s --format='%ce' HEAD);date=$utcDate}
  $message=((git show -s --format='%B' HEAD)-join "`n").TrimEnd("`r","`n")
  @{tree=$tree;parents=@($remoteCommit);message=$message;author=$author;committer=$committer}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $inputFile -Encoding utf8NoBOM
  $created=gh api --method POST "repos/$Repository/git/commits" --input $inputFile | ConvertFrom-Json -DateKind String
  if ($LASTEXITCODE -ne 0 -or !$created.sha) { throw 'Commit creation failed.' }
  @{sha=$created.sha;force=$false}|ConvertTo-Json|Set-Content -LiteralPath $inputFile -Encoding utf8NoBOM
  gh api --method PATCH "repos/$Repository/git/refs/heads/$Branch" --input $inputFile --jq '.object.sha'
  if ($LASTEXITCODE -ne 0) { throw 'Branch publication failed.' }
  # Adopt the exact GitHub commit (GitHub stores API-created messages without a final newline).
  $epoch=[DateTimeOffset]::Parse($created.author.date).ToUnixTimeSeconds()
  $committerEpoch=[DateTimeOffset]::Parse($created.committer.date).ToUnixTimeSeconds()
  $raw="tree $tree`nparent $remoteCommit`nauthor $($created.author.name) <$($created.author.email)> $epoch +0000`ncommitter $($created.committer.name) <$($created.committer.email)> $committerEpoch +0000`n`n$($created.message)"
  [IO.File]::WriteAllText($inputFile,$raw,[Text.UTF8Encoding]::new($false))
  $object=git hash-object -t commit -w -- $inputFile
  if ($object -ne $created.sha) { throw 'Cannot adopt the remote commit; source trees still match, inspect metadata.' }
  git update-ref "refs/heads/$Branch" $object $localCommit
  git update-ref "refs/remotes/origin/$Branch" $object
  [pscustomobject]@{sourceSha=$object;tree=$tree;changedFiles=$entries.Count}|ConvertTo-Json
} finally { Remove-Item -LiteralPath $inputFile -ErrorAction SilentlyContinue }
