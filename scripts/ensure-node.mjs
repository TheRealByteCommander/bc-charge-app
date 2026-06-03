const major = Number(process.versions.node.split('.')[0]);

if (major < 18) {
  console.error('');
  console.error('BC Charge: Node.js 18 oder höher ist erforderlich (Vite 5).');
  console.error(`Aktuell: ${process.version}`);
  console.error('');
  console.error('Windows (Cursor-Node 22, nur diese CMD-Sitzung):');
  console.error('  set PATH=D:\\cursor\\resources\\app\\resources\\helpers;%PATH%');
  console.error('  node -v');
  console.error('  npm run dev');
  console.error('');
  console.error('Oder Doppelklick auf dev-start.cmd im Projektordner.');
  console.error('Dauerhaft: https://nodejs.org/ (LTS) installieren.');
  console.error('');
  process.exit(1);
}
