const fs = require('node:fs');
const source = fs.readFileSync('dist/index.html','utf8');
const html = source.replace(/(src=")(?!assets\/)([^"/]+\.js)(")/g,'$1docs/$2$3').replace('href="style.css"','href="docs/style.css"');
if(process.argv.includes('--check')){
 if(!fs.existsSync('index.html')||fs.readFileSync('index.html','utf8')!==html)throw Error('Run node .github/scripts/pages-entry.cjs to refresh the GitHub Pages root.');
}else fs.writeFileSync('index.html',html);
