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

function process_ticket_order_wb(wb) {
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
        if (row >= 3) { // data start from row 3
          //console.log("col="+ colStr + " row="+ row+ " value=" +JSON.stringify(ws[z].v));
          if (lastRow !== -1 && lastRow !== row) {
            tickets.push(tradeRow);
            console.log("tradeRow="+ tradeRow);
            tradeRow = {};
            lastRow  = row;
          }

          if (lastRow === -1) {
            lastRow = row;
          }


          switch (colStr) {
            case 'A':
              tradeRow['orderNumber'] = ws[z].v;
              break;
            case 'B':
              tradeRow['date'] = ws[z].v;
              break;
            case 'C':
              tradeRow['fund'] = ws[z].v;
              break;
            case 'D':
              tradeRow['code'] = ws[z].v;
              break;
            case 'E':
              tradeRow['name'] = ws[z].v;
              break;
            case 'F':
              tradeRow['orderType'] = ws[z].v;
              break;
            case 'G':
              tradeRow['orderSize'] = ws[z].v;
              break;
            case 'H':
              tradeRow['limitPrice'] = ws[z].v;
              break;
            case 'I':
              tradeRow['tradeType'] = ws[z].v;
              break;
            case 'J':
              tradeRow['brokerCode'] = ws[z].v;
              break;
          } //end switch
        } //end if
      }
    }
  });
  return tickets;
};


var DropzoneDemo = React.createClass({

  getInitialState: function() {
    return {orderTicket: []};
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
              if (name.match(/Order_[A-Z][a-z]{2}_[0-9]{2}[A-Z]{2}.xlsx/)) {
                //xw(data, process_ticket_order_wb,setState);
                var arr = fixdata(data);
					      wb = X.read(btoa(arr), {type: 'base64'});
                var tickets = process_ticket_order_wb(wb);
                this.setState({orderTicket: tickets});
              }

        		}.bind(this);
            reader.readAsArrayBuffer(f);
            //reader.readAsBinaryString(f);
          },
  render: function() {
            return(
              <div>
                <Dropzone onDrop={this.onDrop} width={150} height={100}>
                  <div> Drop Excel files here</div>
                </Dropzone>
                <TicketTable data={this.state.orderTicket} />
              </div>
            );
          }
});

React.render(<DropzoneDemo />, document.body);
