var X = require('xlsx');

var wb = X.readFile('TestExcel.xlsx');

var sheetNameList = wb.SheetNames;

sheetNameList.forEach(function(y) {
  var ws = wb.Sheets[y];
  for (z in ws) {
    /* all keys that do not begin with "!" correspond to cell address */
    if (z[0] === '!') continue;
    console.log(y + "!" + z + "=" + JSON.stringify(ws[z].v));
  }
});
