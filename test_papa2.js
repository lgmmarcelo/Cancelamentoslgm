import Papa from 'papaparse';
const url = "https://docs.google.com/spreadsheets/d/1RLtBIXLhHzJ5IFJB54LMyaO75btNTghUMFSwjkHOWEI/export?format=csv&gid=1627536051";
fetch(url)
  .then(res => res.text())
  .then(text => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach((row, i) => {
          const carimbo = row['Carimbo de data/hora'];
          const compra = row['Data da Compra'];
          if (!carimbo || !carimbo.includes('/')) console.log(`Row ${i} invalid carimbo:`, carimbo);
          if (!compra || !compra.includes('/')) console.log(`Row ${i} invalid compra:`, compra);
        });
        console.log("Total rows:", results.data.length);
      }
    });
  })
  .catch(err => console.error(err));
