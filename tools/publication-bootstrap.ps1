param([string]$Repository='Self-Command/cosmos-obsidian-publication-fixture')
$ErrorActionPreference='Stop'
if($Repository -ne 'Self-Command/cosmos-obsidian-publication-fixture'){throw 'Only the isolated synthetic publication remote is permitted.'}
$sourceSha='d8099a39aa63f9dddace3fb2c32ce72daa6cae37'
$fixtureRoot=Join-Path $env:TEMP ('cosmos-publication-bootstrap-'+[guid]::NewGuid())
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$archive=Join-Path $fixtureRoot 'source.zip'
Invoke-WebRequest -Uri "https://codeload.github.com/Self-Command/amytis/zip/$sourceSha" -OutFile $archive
Expand-Archive -LiteralPath $archive -DestinationPath $fixtureRoot
$source=Join-Path $fixtureRoot "amytis-$sourceSha"
$siteText=[IO.File]::ReadAllText((Join-Path $source 'site.config.example.ts')).Replace('enabled: false,','enabled: true,').Replace("defaultLocale: 'en'","defaultLocale: 'zh'").Replace("locales: ['en']","locales: ['zh', 'en']").Replace('My Garden','Synthetic Cosmos Acceptance').Replace('https://example.com','https://self-command.github.io/amytis').Replace('providers: [],','providers: [] as string[],').Replace('bottomLinks: [],','bottomLinks: [] as Array<{ text: string; url: string }>,')
$siteText=$siteText.Replace('name: "Articles",','name: { zh: "文章", en: "Articles" },').Replace('name: "Series",','name: { zh: "系列", en: "Series" },').Replace('name: "Books",','name: { zh: "书籍", en: "Books" },').Replace('name: "Flow",','name: { zh: "随笔", en: "Flow" },')
# No production config, content, imports, tests, documentation or personal asset trees are copied.
$allowedRoot=@('package.json','bun.lock','next.config.ts','tsconfig.json','postcss.config.mjs','eslint.config.mjs','site.config.example.ts')
$payload=Join-Path $fixtureRoot 'api.json'
$entries=@()
foreach($codeFile in Get-ChildItem -LiteralPath $source -File -Recurse) {
  $relative=[IO.Path]::GetRelativePath($source,$codeFile.FullName).Replace('\','/')
  if($allowedRoot -contains $relative -or $relative.StartsWith('src/') -or $relative.StartsWith('packages/') -or $relative.StartsWith('scripts/') -or $relative -match '^public/[^/]+\.svg$') {
    if($codeFile.Extension -match '^\.(ico|woff2?|ttf|otf|png|jpg|gif)$'){
      @{content=[Convert]::ToBase64String([IO.File]::ReadAllBytes($codeFile.FullName));encoding='base64'}|ConvertTo-Json|Set-Content -LiteralPath $payload -Encoding utf8NoBOM
      $blob=gh api --method POST "repos/$Repository/git/blobs" --input $payload --jq '.sha'
      if($LASTEXITCODE -ne 0){throw 'Cannot publish exact binary asset.'}
      $entries+=@{path=$relative;mode='100644';type='blob';sha=$blob}
    } else {$entries+=@{path=$relative;mode='100644';type='blob';content=[IO.File]::ReadAllText($codeFile.FullName)}}
  }
}
$entries+=@{path='site.config.ts';mode='100644';type='blob';content=$siteText}
$entries+=@{path='fixture-bun.d.ts';mode='100644';type='blob';content='/// <reference types="bun" />'}
$entries+=@{path='content/posts/bootstrap.md';mode='100644';type='blob';content="---`ntitle: Synthetic bootstrap`ndate: '2026-10-01'`ntags: [acceptance]`n---`n`nThis is synthetic acceptance content.`n"}
foreach($kind in @('notes','flows','series','books','en/posts','en/notes','en/flows','en/series','en/books')){$entries+=@{path="content/$kind/.gitkeep";mode='100644';type='blob';content=''}}
$deploy=@'
name: Synthetic Amytis deployment
on:
  push: {branches: [main]}
  workflow_dispatch:
permissions: {contents: read, pages: write, id-token: write}
concurrency: {group: pages, cancel-in-progress: false}
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: oven-sh/setup-bun@v1
        with: {bun-version: '1.3.11'}
      - run: bun install --frozen-lockfile
      - run: bun run build:dev
      # Keep the exact pinned /amytis basePath. All test URL reads map to this nested path.
      - run: mkdir -p pages/amytis && cp -a out/. pages/amytis/
      - uses: actions/upload-pages-artifact@v4
        with: {path: pages/}
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: {name: github-pages, url: '${{ steps.deployment.outputs.page_url }}'}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
'@
$entries+=@{path='.github/workflows/deploy.yml';mode='100644';type='blob';content=$deploy}
$entries+=@{path='README.md';mode='100644';type='blob';content="# Synthetic Cosmos publication acceptance`n`nRenderer code from Self-Command/amytis at $sourceSha. Production content, configuration, imports and documents were excluded. Only this remote receives synthetic acceptance uploads.`n`nPages has a nested /amytis path. Test requests map owner/repo from Self-Command/amytis to this repository and map page reads to /cosmos-obsidian-publication-fixture/amytis. Canonical URLs inside exports remain unchanged to validate the production serialization contract; fixture navigation is not production website acceptance.`n"}
$parent=gh api "repos/$Repository/git/ref/heads/main" --jq '.object.sha'
$base=gh api "repos/$Repository/git/commits/$parent" --jq '.tree.sha'
@{base_tree=$base;tree=$entries}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $payload -Encoding utf8NoBOM
$tree=gh api --method POST "repos/$Repository/git/trees" --input $payload --jq '.sha'
if($LASTEXITCODE -ne 0){throw 'Fixture tree failed.'}
@{tree=$tree;parents=@($parent);message='Bootstrap isolated synthetic renderer from pinned Amytis source'}|ConvertTo-Json|Set-Content -LiteralPath $payload -Encoding utf8NoBOM
$commit=gh api --method POST "repos/$Repository/git/commits" --input $payload --jq '.sha'
if($LASTEXITCODE -ne 0){throw 'Fixture commit failed.'}
@{build_type='workflow';source=@{branch='main';path='/'}}|ConvertTo-Json|Set-Content -LiteralPath $payload -Encoding utf8NoBOM
$existingPages=gh api "repos/$Repository/pages" --jq '.html_url' 2>$null
if($LASTEXITCODE -ne 0){gh api --method POST "repos/$Repository/pages" --input $payload --jq '.html_url';if($LASTEXITCODE -ne 0){throw 'Fixture Pages configuration failed.'}}
@{sha=$commit;force=$false}|ConvertTo-Json|Set-Content -LiteralPath $payload -Encoding utf8NoBOM
gh api --method PATCH "repos/$Repository/git/refs/heads/main" --input $payload --jq '.object.sha'
if($LASTEXITCODE -ne 0){throw 'Fixture branch update failed.'}
[IO.File]::WriteAllText((Join-Path $fixtureRoot 'synthetic-site.config.ts'),$siteText,[Text.UTF8Encoding]::new($false))
[pscustomobject]@{repository=$Repository;sourceSha=$sourceSha;commit=$commit;files=$entries.Count;syntheticSiteConfigBlob=(git hash-object --no-filters -- (Join-Path $fixtureRoot 'synthetic-site.config.ts'))}|ConvertTo-Json
