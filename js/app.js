/*
 * @jsx React.DOM
 */

var React = require('react');
var jszip = require('jszip');

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

var DropzoneDemo = React.createClass({

  xw_xfer: function(data, cb) {
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
  },
  xw: function (data, cb) {
  	if(transferable) this.xw_xfer(data, cb);
  	else this.xw_noxfer(data, cb);
  },
  process_wb: function(wb) {
    var sheetNameList = wb.SheetNames;

    sheetNameList.forEach(function(y) {
      var ws = wb.Sheets[y];
      for (z in ws) {
        // all keys that do not begin with "!" correspond to cell address
        if (z[0] === '!') continue;
        console.log(y + "!" + z + "=" + JSON.stringify(ws[z].v));
      }
    });
  },
  onDrop: function( files ) {
            console.log('Received files: ', files[0].name);
            var reader = new FileReader();
            var f = files[0];
		        var name = f.name;

            reader.onload = function(e) {
        			if(typeof console !== 'undefined') console.log("onload", new Date(), rABS, use_worker);
        			var data = e.target.result;
              var wb;
              this.xw(data, this.process_wb);
        			
        		}.bind(this);
            //reader.readAsArrayBuffer(f);
            reader.readAsBinaryString(f);
          },
  render: function() {
            return(
              <div>
                <Dropzone onDrop={this.onDrop} width={150} height={100}>
                  <div> Drop Excel files here</div>
                </Dropzone>
              </div>
            );
          }
});

React.render(<DropzoneDemo />, document.body);
