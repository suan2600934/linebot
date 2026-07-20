const content = require('fs').readFileSync('./knowledge-base.md', 'utf8');
const lines = content.split(/\r?\n/');
const printLine = (i, label) => {
  const parts = lines[i].split('\t');
  console.log('Line ' + i + ' (' + label + '):');
  parts.forEach((p, idx) => { if (p.trim()) console.log('  col' + idx + ': ' + JSON.stringify(p)); });
};
printLine(110, '第1週 header');
printLine(111, '第1週 dates');
printLine(112, '第1週 morning');
printLine(113, '第1週 afternoon');
printLine(114, '第1週 evening');
printLine(116, '第2週 header');
printLine(117, '第2週 morning');