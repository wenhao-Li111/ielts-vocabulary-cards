param([Parameter(Mandatory=$true)][string]$JavaHome,[Parameter(Mandatory=$true)][string]$SdkRoot)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $env:LOCALAPPDATA 'IELTSCardsBuild/build'
$toolsDir = Join-Path $SdkRoot 'build-tools/35.0.0'
$androidJar = Join-Path $SdkRoot 'platforms/android-35/android.jar'
$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome/bin;$env:PATH"
function Run-Checked([string]$Program,[string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with code $LASTEXITCODE" }
}
New-Item -ItemType Directory -Force -Path "$buildDir/classes","$buildDir/dex","$buildDir/res","$projectRoot/release" | Out-Null
# AAPT2 on Windows does not reliably open Unicode project paths.
Copy-Item -Path "$projectRoot/android/res/*" -Destination "$buildDir/res" -Recurse -Force
Copy-Item -LiteralPath "$projectRoot/android/AndroidManifest.xml" -Destination "$buildDir/AndroidManifest.xml" -Force
Run-Checked 'node' @("$PSScriptRoot/prepare-android.cjs","$buildDir/assets")
Run-Checked "$toolsDir/aapt2.exe" @('compile','--dir',"$buildDir/res",'-o',"$buildDir/resources.zip")
Run-Checked "$toolsDir/aapt2.exe" @('link','-o',"$buildDir/base.apk",'-I',$androidJar,'--manifest',"$buildDir/AndroidManifest.xml",'-A',"$buildDir/assets",'--min-sdk-version','26','--target-sdk-version','35',"$buildDir/resources.zip")
$sources = @(Get-ChildItem -LiteralPath "$projectRoot/android/src" -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
Run-Checked "$JavaHome/bin/javac.exe" (@('-encoding','UTF-8','--release','8','-classpath',$androidJar,'-d',"$buildDir/classes") + $sources)
Run-Checked "$JavaHome/bin/jar.exe" @('cf',"$buildDir/classes.jar",'-C',"$buildDir/classes",'.')
Run-Checked "$toolsDir/d8.bat" @('--lib',$androidJar,'--min-api','26','--output',"$buildDir/dex","$buildDir/classes.jar")
Run-Checked "$JavaHome/bin/jar.exe" @('uf',"$buildDir/base.apk",'-C',"$buildDir/dex",'classes.dex')
Run-Checked "$toolsDir/zipalign.exe" @('-f','-p','4',"$buildDir/base.apk","$buildDir/aligned.apk")
# Signing material remains outside the repository and is reused for installable updates.
$signingDir = Join-Path $env:LOCALAPPDATA 'IELTSCardsBuild/signing'
New-Item -ItemType Directory -Force -Path $signingDir | Out-Null
$keyPath = Join-Path $signingDir 'release.jks'
$passwordPath = Join-Path $signingDir 'password.txt'
if (-not (Test-Path -LiteralPath $keyPath)) {
    if (-not (Test-Path -LiteralPath $passwordPath)) {
        $randomBytes = New-Object byte[] 32
        [System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
        [Convert]::ToBase64String($randomBytes) | Set-Content -LiteralPath $passwordPath -Encoding ascii -NoNewline
    }
    $env:IELTS_SIGN_PASSWORD = Get-Content -LiteralPath $passwordPath -Raw
    Run-Checked "$JavaHome/bin/keytool.exe" @('-genkeypair','-keystore',$keyPath,'-alias','ielts-cards','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=wenhao-Li111, OU=IELTS Cards','-storepass:env','IELTS_SIGN_PASSWORD','-keypass:env','IELTS_SIGN_PASSWORD')
}
$env:IELTS_SIGN_PASSWORD = Get-Content -LiteralPath $passwordPath -Raw
try {
    Run-Checked "$toolsDir/apksigner.bat" @('sign','--ks',$keyPath,'--ks-key-alias','ielts-cards','--ks-pass','env:IELTS_SIGN_PASSWORD','--out',"$projectRoot/release/IELTS-Cards-1.1.0.apk","$buildDir/aligned.apk")
    Run-Checked "$toolsDir/apksigner.bat" @('verify','--verbose',"$projectRoot/release/IELTS-Cards-1.1.0.apk")
} finally { Remove-Item Env:IELTS_SIGN_PASSWORD -ErrorAction SilentlyContinue }
Write-Output "APK ready: $projectRoot/release/IELTS-Cards-1.1.0.apk"
