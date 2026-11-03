const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserPath = fs.existsSync(chromePath) ? chromePath : edgePath;

function renderPng(svgRelative, pngRelative, width, height) {
  const svgPath = path.resolve(svgRelative);
  const pngPath = path.resolve(pngRelative);
  const fileUrl = 'file:///' + svgPath.replace(/\\/g, '/');

  const cmd = `"${browserPath}" --headless --screenshot="${pngPath}" --window-size=${width},${height} --default-background-color=00000000 --hide-scrollbars "${fileUrl}"`;
  console.log(`Rendering ${svgRelative} -> ${pngRelative} (${width}x${height})...`);
  execSync(cmd, { stdio: 'inherit' });
  console.log(`Generated: ${pngPath} (${fs.statSync(pngPath).size} bytes)`);
}

renderPng('public/icon-192.svg', 'public/icon-192.png', 192, 192);
renderPng('public/icon-512.svg', 'public/icon-512.png', 512, 512);
renderPng('public/icon-maskable.svg', 'public/icon-maskable.png', 512, 512);
console.log('All PNG icons generated successfully!');
