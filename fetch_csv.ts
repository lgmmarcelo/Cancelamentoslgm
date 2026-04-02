import fetch from 'node-fetch';
import Papa from 'papaparse';

async function run() {
  const url = 'https://docs.google.com/spreadsheets/d/1RLtBIXLhHzJ5IFJB54LMyaO75btNTghUMFSwjkHOWEI/export?format=csv&gid=1627536051';
  const res = await fetch(url);
  const text = await res.text();
  
  Papa.parse(text, {
    header: true,
    complete: (results) => {
      console.log('Headers:', results.meta.fields);
      console.log('First row:', results.data[0]);
    }
  });
}
run();
