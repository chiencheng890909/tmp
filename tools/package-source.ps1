$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$rootPrefix = $projectRoot.TrimEnd('\') + '\'
$outputDirectory = Join-Path $projectRoot 'packages'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$archiveName = 'WUI-source-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 4) + '.zip'
$archivePath = Join-Path $outputDirectory $archiveName

# Explicit source-only list: generated files and local environment files stay out.
$rootFiles = @('.gitignore', '.python-version', 'main.py', 'pyproject.toml', 'Plan.md', 'README.md', 'EMAIL-README.md')
$webFiles = @('.gitignore', 'index.html', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'vite.config.js', 'playwright.config.js')
$files = [System.Collections.Generic.List[string]]::new()
foreach ($relative in $rootFiles) {
    $path = Join-Path $projectRoot $relative
    if (Test-Path -LiteralPath $path -PathType Leaf) { $files.Add($path) }
}
foreach ($relative in $webFiles) {
    $path = Join-Path (Join-Path $projectRoot 'web') $relative
    if (Test-Path -LiteralPath $path -PathType Leaf) { $files.Add($path) }
}
foreach ($relative in @('web/src', 'web/public', 'web/scripts', 'web/tests', 'tools')) {
    $directory = Join-Path $projectRoot $relative
    if (Test-Path -LiteralPath $directory -PathType Container) {
        foreach ($file in Get-ChildItem -LiteralPath $directory -File -Recurse -Force) {
            if (($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
            if ($file.Name -like '.env*' -or $file.Extension -in @('.pem', '.key', '.pfx')) { continue }
            $files.Add($file.FullName)
        }
    }
}

$archive = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($path in $files) {
        $absolute = [System.IO.Path]::GetFullPath($path)
        if (-not $absolute.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Source path is outside the project.' }
        $relative = $absolute.Substring($rootPrefix.Length).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $absolute, 'WUI/' + $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {
    $archive.Dispose()
}
$fileInfo = Get-Item -LiteralPath $archivePath
[pscustomobject]@{ Archive = $fileInfo.FullName; Files = $files.Count; SizeKB = [math]::Round($fileInfo.Length / 1KB, 1) }
