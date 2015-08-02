var express = require('express');
var app = express();
var http = require('http').Server(app);
var io   = require('socket.io')(http);

var mysql = require('mysql');
var conn  = mysql.createConnection({
  host: 'localhost',
  user: 'world',
  password: 'world',
  database: 'world',
  port : 3306
});

var POLLING_INTERVAL = 3000, 
    polingTimer,
    connArray = [];

//app.get('/', function(req,res) {
//  res.sendFile(__dirname + '/checker.html');
//});

app.use(express.static('.'));

conn.connect( function(err) {
  if (err) {
    console.log(err);
  }
});

var pollingselect = function() {

  var data = [];

  var query = conn.query('SELECT * FROM Country');
  console.log('pollingselect start..'); 
  query
  .on('error', function(err) {
      console.log(err);
      udpateSockets(err);
    })
  .on('result', function(row) {
    data.push(row);
  })
  .on('end', function(){
    if (connArray.length) {
      pollingTimer = setTimeout(pollingselect, POLLING_INTERVAL);
      updateSockets({data:data});
    }
  });

};

io.on('connection', function( socket ) {
  console.log('Number of conn: '+ connArray.length );

  if (!connArray.length) {
    pollingselect();
  }

  socket.on('disconnect', function() {
    var socketIndex = connArray.indexOf(socket);
    console.log('socket = ' + socketIndex + ' disconnected');
    if (socketIndex >= 0) {
      connArray.splice( socketIndex, 1);
    }
  });

  console.log('A new socket is connected!');
  connArray.push(socket);
});

var updateSockets = function( data ) {
  data.time = new Date();
  connArray.forEach( function( socket ) {
    socket.emit('data', data);
  });
};



http.listen(3000, function() {
  console.log('listening on *:3000');
});
