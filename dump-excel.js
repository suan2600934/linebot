const XLSX = require('xlsx');
const path = 'H:\\Gemini\\pss\\賜安診所11507班表.xlsx';
const wb = XLSX.readFile(path);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
console.log('Size:', data.length, 'x', (data[0] || []).length);
data.forEach((row, i) => {
  console.log((i + 1) + ':', JSON.stringify(row));
});
