param(
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [Parameter(Mandatory=$true)][string]$AndroidSdk,
    [string]$Gradle = (Join-Path $PSScriptRoot 'gradlew.bat'),
    [switch]$InitializeSigning
)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath($PSScriptRoot)
$taskPrivate=Join-Path $env:LOCALAPPDATA 'Manmool\AndroidSigning\hyeonjang'
$taskKey=Join-Path $taskPrivate 'release.jks'
$taskPasswordFile=Join-Path $taskPrivate 'password.dpapi'
$taskDistRoot=Join-Path $taskRoot 'dist'
$taskReleaseId='1.0.0-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$taskOutput=Join-Path $taskDistRoot ('.pending-' + $taskReleaseId)
$taskReleaseOutput=Join-Path $taskDistRoot $taskReleaseId
$taskApk=Join-Path $taskOutput 'hyeonjang-galaxy-1.0.0.apk'
$taskOldJava=$env:JAVA_HOME
$taskOldAndroid=$env:ANDROID_HOME
$taskOldPath=$env:PATH

function Assert-Success([string]$Step) {
    if($LASTEXITCODE -ne 0){throw "$Step failed (exit $LASTEXITCODE)"}
}

if(-not(Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))){throw 'JDK 17 is required'}
if(-not(Test-Path -LiteralPath (Join-Path $AndroidSdk 'build-tools\36.0.0\apksigner.bat'))){throw 'Android build-tools 36.0.0 are required'}
if([IO.Path]::GetFullPath($taskPrivate).StartsWith($taskRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Signing keys must stay outside the repository'}

try {
    $env:JAVA_HOME=[IO.Path]::GetFullPath($JavaHome)
    $env:ANDROID_HOME=[IO.Path]::GetFullPath($AndroidSdk)
    $env:PATH="$env:JAVA_HOME\bin;$env:PATH"
    Push-Location $taskRoot
    try {
        & $Gradle --no-daemon --console=plain testDebugUnitTest lintRelease assembleRelease
        Assert-Success 'Android tests/lint/build'
    } finally { Pop-Location }

    $taskUnsigned=Join-Path $taskRoot 'app\build\outputs\apk\release\app-release-unsigned.apk'
    $taskBadging=& (Join-Path $AndroidSdk 'build-tools\36.0.0\aapt.exe') dump badging $taskUnsigned
    Assert-Success 'Compiled APK metadata'
    if(-not($taskBadging -match "^package: name='kr\.manmool\.hyeonjang' versionCode='1' versionName='1\.0\.0'")){
        throw 'Unexpected compiled package/version. Update release metadata together with the Android version.'
    }
    if($taskBadging -match '^application-debuggable'){throw 'Debuggable APK cannot be released'}
    if(-not($taskBadging -match "^sdkVersion:'24'") -or -not($taskBadging -match "^targetSdkVersion:'36'")){
        throw 'Unexpected Android API requirements'
    }
    $taskAllowedPermissions=@('android.permission.INTERNET','kr.manmool.hyeonjang.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION')
    foreach($taskLine in $taskBadging){
        if($taskLine -match "^uses-permission: name='([^']+)'"){
            if($Matches[1] -notin $taskAllowedPermissions){throw 'Unexpected APK permission'}
        }
    }

    # Check the post-merge release surface, not only our source manifest.
    $taskMergedManifest=Join-Path $taskRoot 'app\build\intermediates\merged_manifests\release\processReleaseManifest\AndroidManifest.xml'
    [xml]$taskMerged=[IO.File]::ReadAllText($taskMergedManifest)
    $taskApplication=$taskMerged.manifest.application
    $taskAndroidNs='http://schemas.android.com/apk/res/android'
    $taskActivities=@($taskApplication.SelectNodes('activity'))
    if($taskActivities.Count -ne 1 -or $taskActivities[0].GetAttribute('name',$taskAndroidNs) -ne 'kr.manmool.hyeonjang.MainActivity'){
        throw 'Unexpected merged activity: release surface must contain only MainActivity'
    }
    if($taskApplication.SelectNodes('service|activity-alias').Count -ne 0){throw 'Unexpected merged service or activity alias'}
    foreach($taskProvider in $taskApplication.SelectNodes('provider')){
        if($taskProvider.GetAttribute('name',$taskAndroidNs) -ne 'androidx.startup.InitializationProvider' -or
           $taskProvider.GetAttribute('exported',$taskAndroidNs) -ne 'false'){throw 'Unexpected merged provider'}
    }
    foreach($taskReceiver in $taskApplication.SelectNodes('receiver')){
        if($taskReceiver.GetAttribute('name',$taskAndroidNs) -ne 'androidx.profileinstaller.ProfileInstallReceiver' -or
           $taskReceiver.GetAttribute('permission',$taskAndroidNs) -ne 'android.permission.DUMP'){throw 'Unexpected merged receiver'}
    }
    if($taskApplication.GetAttribute('allowBackup',$taskAndroidNs) -ne 'false' -or
       $taskApplication.GetAttribute('usesCleartextTraffic',$taskAndroidNs) -ne 'false'){
        throw 'Merged manifest must disable backup and cleartext traffic'
    }

    if(-not(Test-Path -LiteralPath $taskKey)) {
        if(-not $InitializeSigning){throw 'No release key. First build requires -InitializeSigning; never create a new key for an existing installation.'}
        if(Test-Path -LiteralPath $taskPasswordFile){throw 'Partial signing state. Preserve it and investigate instead of replacing the password.'}
        New-Item -ItemType Directory -Path $taskPrivate -Force | Out-Null
        $taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        & icacls.exe $taskPrivate /inheritance:r /grant:r "*$($taskSid):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
        Assert-Success 'Private signing directory permissions'
        $taskRandom=New-Object byte[] 48
        $taskRng=[Security.Cryptography.RandomNumberGenerator]::Create()
        try {$taskRng.GetBytes($taskRandom)} finally {$taskRng.Dispose()}
        $env:HJ_APK_STORE_PASSWORD=[Convert]::ToBase64String($taskRandom)
        $taskSecure=ConvertTo-SecureString -String $env:HJ_APK_STORE_PASSWORD -AsPlainText -Force
        # DPAPI is bound to this Windows user. Never print or commit this file or the keystore.
        [IO.File]::WriteAllText($taskPasswordFile,(ConvertFrom-SecureString $taskSecure))
        # keytool writes ordinary generation/JKS notices to stderr on Windows PowerShell 5.
        $taskErrorPreference=$ErrorActionPreference
        try {
            $ErrorActionPreference='Continue'
            & (Join-Path $JavaHome 'bin\keytool.exe') -genkeypair -noprompt -keystore $taskKey -alias hyeonjang-release -keyalg RSA -keysize 3072 -validity 10000 -storetype JKS -storepass:env HJ_APK_STORE_PASSWORD -keypass:env HJ_APK_STORE_PASSWORD -dname 'CN=Hyeonjang Android, O=Manmool, C=KR' 2>&1 | ForEach-Object {Write-Output $_.ToString()}
        } finally {$ErrorActionPreference=$taskErrorPreference}
        Assert-Success 'Release key generation'
    } else {
        if(-not(Test-Path -LiteralPath $taskPasswordFile)){throw 'Signing password missing. Do not replace the existing key.'}
        $taskSecure=ConvertTo-SecureString ([IO.File]::ReadAllText($taskPasswordFile))
        $taskPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
        try {$env:HJ_APK_STORE_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer)}
        finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)}
    }

    New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
    $taskSigner=Join-Path $AndroidSdk 'build-tools\36.0.0\apksigner.bat'
    & $taskSigner sign --ks $taskKey --ks-key-alias hyeonjang-release --ks-pass env:HJ_APK_STORE_PASSWORD --key-pass env:HJ_APK_STORE_PASSWORD --out $taskApk $taskUnsigned
    Assert-Success 'APK signing'
    $taskVerification=& $taskSigner verify --verbose --print-certs $taskApk
    Assert-Success 'APK signature verification'
    $taskVerification | ForEach-Object {Write-Output $_}
    & (Join-Path $AndroidSdk 'build-tools\36.0.0\zipalign.exe') -c -P 16 -v 4 $taskApk | Select-Object -Last 1
    Assert-Success 'APK alignment verification'
    $taskCertificate=($taskVerification | Select-String '^Signer #1 certificate SHA-256 digest: (.+)$').Matches.Groups[1].Value
    $taskManifest=[ordered]@{
        package='kr.manmool.hyeonjang'; version='1.0.0'; versionCode=1; file=[IO.Path]::GetFileName($taskApk)
        sha256=(Get-FileHash -LiteralPath $taskApk -Algorithm SHA256).Hash.ToLowerInvariant()
        certificateSha256=$taskCertificate; bytes=(Get-Item -LiteralPath $taskApk).Length
        builtAtUtc=[DateTime]::UtcNow.ToString('o'); deviceTested=$false; domainVerificationDeployed=$false
    }
    [IO.File]::WriteAllText((Join-Path $taskOutput 'release.json'),($taskManifest|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
    $taskFingerprint=($taskCertificate.ToUpperInvariant() -replace '(..)(?!$)','$1:')
    $taskAssociation=@(@{
        relation=@('delegate_permission/common.handle_all_urls')
        target=@{namespace='android_app'; package_name='kr.manmool.hyeonjang'; sha256_cert_fingerprints=@($taskFingerprint)}
    })
    # Prepared only. This belongs at the ORIGIN root, not /hyeonjang/.well-known/.
    [IO.File]::WriteAllText((Join-Path $taskOutput 'assetlinks.pending.json'),(ConvertTo-Json -InputObject $taskAssociation -Depth 6),[Text.UTF8Encoding]::new($false))
    # Promote only a fully verified, unique build directory. Never overwrite an earlier release.
    $taskExpectedRoot=[IO.Path]::GetFullPath($taskDistRoot) + [IO.Path]::DirectorySeparatorChar
    foreach($taskCandidate in @($taskOutput,$taskReleaseOutput)) {
        if(-not [IO.Path]::GetFullPath($taskCandidate).StartsWith($taskExpectedRoot,[StringComparison]::OrdinalIgnoreCase)){
            throw 'Invalid release directory'
        }
    }
    if(Test-Path -LiteralPath $taskReleaseOutput){throw 'Release output already exists'}
    Rename-Item -LiteralPath $taskOutput -NewName $taskReleaseId
    Write-Output ('APK ready: ' + (Join-Path $taskReleaseOutput 'hyeonjang-galaxy-1.0.0.apk'))
    Write-Output 'Physical Galaxy validation and public distribution have NOT been performed.'
} finally {
    Remove-Item Env:HJ_APK_STORE_PASSWORD -ErrorAction SilentlyContinue
    $env:JAVA_HOME=$taskOldJava
    $env:ANDROID_HOME=$taskOldAndroid
    $env:PATH=$taskOldPath
    if($taskSecure){$taskSecure.Dispose()}
}
