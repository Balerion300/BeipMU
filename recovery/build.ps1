param([switch]$SkipSdkDownload)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$sdkVersion = '1.0.4258.31'
$sdkDir = Join-Path $taskRoot 'vendor/webview2'
if (!(Test-Path "$sdkDir/build/native/include/WebView2.h")) {
    if ($SkipSdkDownload) { throw 'WebView2 SDK missing.' }
    New-Item -ItemType Directory -Force "$taskRoot/vendor" | Out-Null
    $package = "$taskRoot/vendor/webview2.zip"
    Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$sdkVersion/microsoft.web.webview2.$sdkVersion.nupkg" -OutFile $package
    Expand-Archive -LiteralPath $package -DestinationPath $sdkDir -Force
}
$vswhere = "${env:ProgramFiles(x86)}/Microsoft Visual Studio/Installer/vswhere.exe"
$vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (!$vs) { throw 'Install Visual Studio Build Tools with Desktop development with C++.' }
$buildDir = Join-Path $taskRoot 'build'
$dist = Join-Path $taskRoot 'dist/BeipMU-Recovery-0.11'
New-Item -ItemType Directory -Force $buildDir,$dist | Out-Null
$batch = @"
@echo off
call "$vs\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 >nul
if errorlevel 1 exit /b 1
cl /nologo /std:c++20 /EHsc /W4 /O2 /MT /utf-8 /DUNICODE /D_UNICODE /I"$sdkDir\build\native\include" "$taskRoot\main.cpp" /Fo"$buildDir\main.obj" /Fe"$dist\BeipMU-Recovery.exe" "$sdkDir\build\native\x64\WebView2LoaderStatic.lib" /link /SUBSYSTEM:WINDOWS ws2_32.lib ole32.lib oleaut32.lib user32.lib gdi32.lib shell32.lib shlwapi.lib version.lib advapi32.lib secur32.lib comdlg32.lib
if errorlevel 1 exit /b 1
cl /nologo /std:c++20 /EHsc /W4 /O2 /MT /utf-8 "$taskRoot\tests\telnet_test.cpp" /Fo"$buildDir\telnet_test.obj" /Fe"$buildDir\telnet_test.exe"
if errorlevel 1 exit /b 1
"$buildDir\telnet_test.exe"
if errorlevel 1 exit /b 1
cl /nologo /std:c++20 /EHsc /W4 /O2 /MT /utf-8 /DUNICODE /D_UNICODE "$taskRoot\tests\tls_test.cpp" /Fo"$buildDir\tls_test.obj" /Fe"$buildDir\tls_test.exe" /link ws2_32.lib secur32.lib crypt32.lib
if errorlevel 1 exit /b 1
cl /nologo /std:c++20 /EHsc /W4 /O2 /MT /utf-8 /DUNICODE /D_UNICODE "$taskRoot\tests\trigger_audio_native_test.cpp" /Fo"$buildDir\trigger_audio_native_test.obj" /Fe"$buildDir\trigger_audio_native_test.exe"
if errorlevel 1 exit /b 1
cl /nologo /std:c++20 /EHsc /W4 /O2 /MT /utf-8 /DUNICODE /D_UNICODE "$taskRoot\tests\native-log-name-test.cpp" /Fo"$buildDir\native-log-name-test.obj" /Fe"$buildDir\native-log-name-test.exe"
if errorlevel 1 exit /b 1
"$buildDir\native-log-name-test.exe"
if errorlevel 1 exit /b 1
"@
$batchPath = Join-Path $buildDir 'compile.cmd'
[IO.File]::WriteAllText($batchPath,$batch.Replace("`n","`r`n"),[Text.Encoding]::Default)
& $batchPath
if ($LASTEXITCODE -ne 0) { throw "C++ build/tests failed ($LASTEXITCODE)." }
Copy-Item -LiteralPath "$taskRoot/ui" -Destination $dist -Recurse -Force
Copy-Item -LiteralPath "$taskRoot/../LICENSE" -Destination $dist -Force
Copy-Item -LiteralPath "$taskRoot/README.md" -Destination "$dist/README.md" -Force
Copy-Item -LiteralPath "$taskRoot/FEATURE-PARITY.md" -Destination "$dist/FEATURE-PARITY.md" -Force
Copy-Item -LiteralPath "$taskRoot/UI-REFERENCE.md" -Destination "$dist/UI-REFERENCE.md" -Force
Copy-Item -LiteralPath "$taskRoot/COMPLETION-CHECKLIST.md" -Destination "$dist/COMPLETION-CHECKLIST.md" -Force
Copy-Item -LiteralPath "$taskRoot/SCRIPT-PARITY.md" -Destination "$dist/SCRIPT-PARITY.md" -Force
Copy-Item -LiteralPath "$taskRoot/examples" -Destination $dist -Recurse -Force
Copy-Item -LiteralPath "$sdkDir/LICENSE.txt" -Destination "$dist/WebView2-SDK-LICENSE.txt" -Force
foreach ($testFile in Get-ChildItem -LiteralPath "$taskRoot/tests" -Filter "*_test.cjs") {
    & node $testFile.FullName
    if ($LASTEXITCODE -ne 0) { throw "JavaScript tests failed: $($testFile.Name)" }
}
Compress-Archive -Path "$dist/*" -DestinationPath "$taskRoot/dist/BeipMU-Recovery-0.11-x64.zip" -Force
Write-Output "Built: $dist/BeipMU-Recovery.exe"
