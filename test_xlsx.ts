import * as XLSX from 'xlsx';
import fetch from 'node-fetch';

async function run() {
  const url = 'https://docs.google.com/spreadsheets/d/1RLtBIXLhHzJ5IFJB54LMyaO75btNTghUMFSwjkHOWEI/export?format=xlsx&gid=1627536051';
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  
  console.log('Headers:', Object.keys(jsonData[0]));
}
run();
