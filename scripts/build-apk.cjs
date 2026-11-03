const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const javaHome = process.env.JAVA_HOME || 'C:\\Users\\Seven Studio PC\\AppData\\Local\\Programs\\jdk-17\\jdk-17.0.12+7';
const androidHome = process.env.ANDROID_HOME || 'C:\\Users\\Seven Studio PC\\AppData\\Local\\Android\\Sdk';

console.log('[APK Build] JAVA_HOME:', javaHome);
console.log('[APK Build] ANDROID_HOME:', androidHome);

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  PATH: `${path.join(javaHome, 'bin')};${process.env.PATH}`,
};

const androidDir = path.resolve('android');
const gradlew = path.join(androidDir, 'gradlew.bat');

try {
  console.log('[APK Build] Stopping existing gradle daemons...');
  execSync(`"${gradlew}" --stop`, { cwd: androidDir, env, stdio: 'inherit' });
} catch {}

console.log('[APK Build] Executing assembleDebug --no-daemon...');
try {
  execSync(`"${gradlew}" assembleDebug --no-daemon`, {
    cwd: androidDir,
    env,
    stdio: 'inherit',
  });

  const candidates = [
    'C:\\Users\\Seven Studio PC\\AppData\\Local\\Temp\\drive_music_build\\app\\outputs\\apk\\debug\\app-debug.apk',
    path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  ];
  let apkPath = candidates.find((p) => fs.existsSync(p));

  if (apkPath) {
    const stats = fs.statSync(apkPath);
    console.log(`[APK Build] SUCCESS! APK built at: ${apkPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Copy to public/apk/drive-music-player.apk and dist/apk/drive-music-player.apk
    const publicApkDir = path.resolve('public', 'apk');
    if (!fs.existsSync(publicApkDir)) fs.mkdirSync(publicApkDir, { recursive: true });
    const targetApk = path.join(publicApkDir, 'drive-music-player.apk');
    fs.copyFileSync(apkPath, targetApk);
    console.log(`[APK Build] Copied APK to ${targetApk}`);

    const info = {
      available: true,
      fileName: 'drive-music-player.apk',
      version: '1.0.0',
      fileSizeBytes: stats.size,
      fileSizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      builtAt: new Date().toISOString(),
      rawPath: apkPath,
    };
    fs.writeFileSync(path.join(publicApkDir, 'info.json'), JSON.stringify(info, null, 2));

    const distApkDir = path.resolve('dist', 'apk');
    if (!fs.existsSync(distApkDir)) fs.mkdirSync(distApkDir, { recursive: true });
    fs.copyFileSync(apkPath, path.join(distApkDir, 'drive-music-player.apk'));
    fs.writeFileSync(path.join(distApkDir, 'info.json'), JSON.stringify(info, null, 2));
    console.log('[APK Build] Wrote APK metadata to info.json');
  } else {
    console.error('[APK Build] APK file not found after build!');
    process.exit(1);
  }
} catch (err) {
  console.error('[APK Build] Gradle build failed:', err.message);
  process.exit(1);
}
