const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '../node_modules/magic-string/package.json');
const mjsPath = path.resolve(__dirname, '../node_modules/magic-string/dist/index.mjs');
const cjsPath = path.resolve(__dirname, '../node_modules/magic-string/dist/index.cjs');

if (fs.existsSync(pkgPath) && fs.existsSync(mjsPath)) {
  if (!fs.existsSync(cjsPath)) {
    try {
      // Look for esbuild in project node_modules
      const esbuildPath = path.resolve(__dirname, '../../backend/node_modules/esbuild');
      const esbuild = require(esbuildPath);
      esbuild.buildSync({
        entryPoints: [mjsPath],
        bundle: true,
        format: 'cjs',
        outfile: cjsPath,
      });
    } catch {
      // If esbuild not found, duplicate mjs to cjs as fallback
      fs.copyFileSync(mjsPath, cjsPath);
    }
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.main = './dist/index.cjs';
  pkg.module = './dist/index.cjs';
  pkg.exports = {
    '.': {
      types: './dist/index.d.mts',
      import: './dist/index.cjs',
      require: './dist/index.cjs',
      default: './dist/index.cjs',
    },
    './package.json': './package.json',
  };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}
