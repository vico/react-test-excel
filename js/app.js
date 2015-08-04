/*
 * @jsx React.DOM
 */

var React = require('react');
var jszip = require('jszip');
var TicketTable = require('./components/TicketTable.react');

var Dropzone = require('react-dropzone');

var X = XLSX;
var XW = {
  /* worker message */
  msg: 'js/xlsx',
  /* worker scripts */
  rABS: 'js/xlsxworker2.js',
  norABS: 'js/xlsxworker1.js',
  noxfer: 'js/xlsxworker.js'
};

var rABS = typeof FileReader !== "undefined" && typeof FileReader.prototype !== "undefined" && typeof FileReader.prototype.readAsBinaryString !== "undefined";

var use_worker = typeof Worker !== 'undefined';
var transferable = use_worker;
var wtf_mode = false;

function fixdata(data) {
  var o = "", l = 0, w = 10240;
  for(; l<data.byteLength/w; ++l) o+=String.fromCharCode.apply(null,new Uint8Array(data.slice(l*w,l*w+w)));
  o+=String.fromCharCode.apply(null, new Uint8Array(data.slice(l*w)));
  return o;
};

function ab2str(data) {
  var o = "", l = 0, w = 10240;
  for(; l<data.byteLength/w; ++l) o+=String.fromCharCode.apply(null,new Uint16Array(data.slice(l*w,l*w+w)));
  o+=String.fromCharCode.apply(null, new Uint16Array(data.slice(l*w)));
  return o;
};

function s2ab(s) {
  var b = new ArrayBuffer(s.length*2), v = new Uint16Array(b);
  for (var i=0; i != s.length; ++i) v[i] = s.charCodeAt(i);
  return [v, b];
};

function xw_xfer(data, cb) {
  var worker = new Worker(rABS ? XW.rABS : XW.norABS);
  worker.onmessage = function(e) {
    switch(e.data.t) {
      case 'ready': break;
      case 'e': console.error(e.data.d); break;
      default: xx=ab2str(e.data).replace(/\n/g,"\\n").replace(/\r/g,"\\r"); console.log("done"); cb(JSON.parse(xx)); break;
    }
  };
  if(rABS) {
    var val = s2ab(data);
    worker.postMessage(val[1], [val[1]]);
  } else {
    worker.postMessage(data, [data]);
  }
};


function xw(data, cb) {
  if(transferable) xw_xfer(data, cb);
  else xw_noxfer(data, cb);
};

function ticketOrder(tradeRow, colStr, value, fund) {
  switch (colStr) {
    case 'A':
      tradeRow['orderNumber'] = value;
      break;
    case 'B':
      tradeRow['date'] = value;
      break;
    case 'C':
      tradeRow['fund'] = value;
      break;
    case 'D':
      tradeRow['code'] = value;
      break;
    case 'E':
      tradeRow['name'] = value;
      break;
    case 'F':
      tradeRow['orderType'] = value;
      break;
    case 'G':
      tradeRow['orderSize'] = value;
      break;
    case 'H':
      tradeRow['limitPrice'] = value;
      break;
    case 'I':
      tradeRow['tradeType'] = value;
      break;
    case 'J':
      tradeRow['brokerCode'] = value;
      break;
  } //end switch
}


function execTrade(tradeRow, colStr, value, fund) {
  switch (colStr) {
    case 'A':
      tradeRow['orderNumber'] = value;
      break;
    case 'B':
      tradeRow['code'] = value;
      break;
    case 'C':
      tradeRow['name'] = value;
      break;
    case 'D':
      tradeRow['orderType'] =  (value === 'Buy Cover' ? 'COVER' :
            (value === 'Sell Short' ? 'SHORT': ( value === 'Sell' ? 'SELL': 'BUY'))) ;
      break;
    case 'E':
      if (fund === 'R') tradeRow['RH'] = value;
      else if (fund === 'Y') tradeRow['YA'] = value;
      else tradeRow['LR'] = value;
      break;
    case 'F':
      tradeRow['executed'] = value;
      break;
    case 'G':
      tradeRow['avgprice'] = value;
      break;
    case 'H':
      tradeRow['brokerCode'] = value;
      break;
    case 'I':
      tradeRow['rate'] = value;
      break;
    case 'J':
      tradeRow['PB'] = value;
      break;
  } //end switch
}


function process_wb(wb, selectFunc, startRow, fund) {
  var sheetNameList = wb.SheetNames;
  var tickets = [];

  sheetNameList.forEach(function(y) {
    var ws = wb.Sheets[y];
    var pattern = /([A-Z]+)([0-9]+)/;

    var lastRow = -1;
    var tradeRow = {};
    for (z in ws) {
      // all keys that do not begin with "!" correspond to cell address
      if (z[0] === '!') continue;
      //console.log(y + "!" + z + "=" + JSON.stringify(ws[z].v) + " type:" + ( typeof z)+ " " + (typeof ws[z].v));
      var matches = pattern.exec(z); // extract column string and row number
      var colStr, row;
      if (matches) {
        colStr = matches[1];
        row    = matches[2];
        if (row >= startRow) { // data start from row startRow
          //console.log("col="+ colStr + " row="+ row+ " value=" +JSON.stringify(ws[z].v));
          if (lastRow !== -1 && lastRow !== row) {
            tickets.push(tradeRow);
            tradeRow = {};
            lastRow  = row;
          }

          if (lastRow === -1) {
            lastRow = row;
          }
          // put right value to tradeRow depends on column char
          selectFunc(tradeRow, colStr, ws[z].v, fund);

        } //end if
      }
    }
    // add last row
    tickets.push(tradeRow);
  });
  return tickets;
};

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function compareF(a,b) {
  if (isNumeric(a.code) && isNumeric(b.code)) {
    if (a.code !== b.code) {
      return a.code - b.code;
    } else {
      return a.orderType.localeCompare(b.orderType);
    }
  } else if (! isNumeric(a.code)) {
    return 1;
  } else {
    return -1;
  }
}

function merge( ticket, exec) {

  if (! ticket) return exec;
  if (! exec)  return ticket;
  console.log("merge start");
  ticket.sort(compareF);
  exec.sort(compareF);
  var i = 0, j = 0, k = 0;
  var data = [];
  while (i < ticket.length && j < exec.length) {
    //console.log("ticket length ="+ ticket.length +" exelen="+ exec.length+",i ="+i+", j="+j+", k="+k +", comp1=" + (i < ticket.length)+", comp2="+(j<exec.length)+", code1=" + ticket[i].code +", code2="+ exec[j].code);
    if (ticket[i].code < exec[j].code) {
      data[k] = ticket[i];
      i++;
      k++;
    } else if (ticket[i].code > exec[j].code) {
      data[k] = exec[j];
      console.log(exec.fund);
      if (exec.fund === 'R') {
        data[k]['RH'] = exec[j].RH;
      } else if (exec.fund === 'Y') {
        data[k]['YA'] = exec[j].YA;
      } else if (exec.fund === 'Long') {
        data[k]['LR'] = exec[j].LR;
      } else {
        console.log("something wrong");
      }
      j++;
      k++;
    } else if (ticket[i].orderType === exec[j].orderType ) {
      data[k] = ticket[i];
      console.log(exec.fund);
      if (exec.fund === 'R') {
        data[k]['RH'] = exec[j].RH;
      } else if (exec.fund === 'Y') {
        data[k]['YA'] = exec[j].YA;
      } else if (exec.fund === 'Long') {
        data[k]['LR'] = exec[j].LR;
      } else {
        console.log("something wrong");
      }
      k++;
      i++;
      j++;
    } else {
      console.log(ticket[i].orderType, exec[j].orderType);
      break;
    }

    //if (i === 40) break;
  }
  console.log("basic comparison end");
  while (i < ticket.length) {
    console.log("ticket remained");
    data[k] = ticket[i];
    i++;
    k++;
  }
  while (j < exec.length) {
    console.log("exec remaind");
    data[k] = exec[j];
    j++;
    k++;
  }
  return data;
}

var DropzoneDemo = React.createClass({

  getInitialState: function() {
    return {data: [], ticketOrder: false, rhexec: false, yaexec: false, lrexec: false};
  },

  onDrop: function( files ) {
            console.log('Received files: ', files[0].name);
            var reader = new FileReader();
            var f = files[0];
		        var name = f.name;
            var setState = this.setState;
            reader.onload = function(e) {
        			if(typeof console !== 'undefined') console.log("onload", new Date(), rABS, use_worker);
        			var data = e.target.result;
              var wb;
              var orderPattern = /Order_[A-Z][a-z]{2}_[0-9]{2}[A-Z]{2}.xlsx/;
              var execPattern = /([0-9]{2})([A-Z][a-z]{2})Exe\((R|Y|Long)\).xlsx/;
              var matches;
              if (matches = orderPattern.exec(name)) {
                //xw(data, process_ticket_order_wb,setState);
                var arr = fixdata(data);
					      wb = X.read(btoa(arr), {type: 'base64'});
                var tickets = process_wb(wb, ticketOrder, 3, ''); // data start from row 3
                if (! this.state.ticketOrder) {
                  this.setState({data: tickets, ticketOrder: true});
                }
              } else if (matches = execPattern.exec(name)) {
                console.log(matches[1],matches[2],matches[3]);
                var arr = fixdata(data);
					      wb = X.read(btoa(arr), {type: 'base64'});
                var exec = process_wb(wb, execTrade, 7, matches[3]); // data start from row 7
                exec['fund'] = matches[3];
                var newData = [];
                if (this.state.ticketOrder) {
                  newData = merge(this.state.data, exec);
                  console.log(newData);
                } else {
                  newData = exec;
                }
                this.setState({ data: newData});
              }

        		}.bind(this);
            reader.readAsArrayBuffer(f);
            //reader.readAsBinaryString(f);
          },
  render: function() {
            return(
              <div>
                <Dropzone onDrop={this.onDrop} width={800} height={100}>
                  <div> Drop Excel files here</div>
                </Dropzone>
                <TicketTable data={this.state.data} />
              </div>
            );
          }
});

React.render(<DropzoneDemo />, document.body);
