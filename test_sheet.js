const url = "https://docs.google.com/spreadsheets/d/1RLtBIXLhHzJ5IFJB54LMyaO75btNTghUMFSwjkHOWEI/export?format=csv&gid=1627536051";
fetch(url)
  .then(res => res.text())
  .then(text => {
    console.log("Status:", text.substring(0, 100));
  })
  .catch(err => console.error(err));
