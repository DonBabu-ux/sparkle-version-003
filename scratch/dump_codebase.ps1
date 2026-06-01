$excludeDirs = @(
    'node_modules', 
    '.git', 
    '.vscode', 
    '.idea', 
    '.logs', 
    'brain', 
    'tmp', 
    'dist', 
    '.gemini', 
    'build', 
    '.gradle', 
    'intermediates', 
    'outputs',
    'gradle',
    'app\build',
    'app\.cxx'
)
$excludeExts = @('.apk', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.db', '.sqlite', '.zip', '.tar.gz', '.pdf', '.docx', '.xlsx', '.jar', '.war', '.bin', '.dex', '.class')

# Create or clear codebase.txt
New-Item -Path "codebase.txt" -ItemType File -Force | Out-Null

Get-ChildItem -Recurse -File | Where-Object {
    $filePath = $_.FullName
    
    # Check if any excluded directory is in the path
    $inExcludedDir = $false
    foreach ($dir in $excludeDirs) {
        if ($filePath -like "*\$dir\*" -or $filePath -like "*\$dir") {
            $inExcludedDir = $true
            break
        }
    }
    
    # Check if file has excluded extension
    $hasExcludedExt = $excludeExts -contains $_.Extension.ToLower()
    
    # Exclude codebase.txt and dump_codebase.ps1 itself
    $isCodebaseTxt = $_.Name -eq "codebase.txt"
    $isDumper = $_.Name -eq "dump_codebase.ps1"
    
    -not $inExcludedDir -and -not $hasExcludedExt -and -not $isCodebaseTxt -and -not $isDumper
} | ForEach-Object {
    # Resolve relative path manually to ensure consistency
    $relPath = $_.FullName.Replace("c:\Users\user\Desktop\BABU DON\SPARKLE\SPARKLE 2\sparkle-version-003\", "").Replace("c:/Users/user/Desktop/BABU DON/SPARKLE/SPARKLE 2/sparkle-version-003/", "")
    Write-Host "Adding $relPath to codebase.txt..."
    "=========================================`r`nFILE: $relPath`r`n=========================================" | Out-File -FilePath "codebase.txt" -Append -Encoding utf8
    if ($_.Length -gt 0) {
        # Using -Raw to read the file as a single string and -ErrorAction SilentlyContinue in case of locked files
        Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue | Out-File -FilePath "codebase.txt" -Append -Encoding utf8
    }
    "`r`n`r`n" | Out-File -FilePath "codebase.txt" -Append -Encoding utf8
}

Write-Host "Done! Codebase dumped to codebase.txt."
