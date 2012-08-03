//File system
var fs = require("fs");

//Include zeromq
var zmq = require("zmq-3.0");

//Config
var config = require("./config.json");

//Read the arguments
var cameraId = process.argv[2];
var detected = process.argv[3]; //(start|stop)

//Connect to zmq socket
var socket = zmq.createSocket('push');

//Connect to receive messages
var address = config.zeromq.protocol + '://' + config.zeromq.host + ':' + config.zeromq.port;
socket.connect(address);

//Send the message to the mains server
socket.send('detection', JSON.stringify({cameraId: id, detected: detected}));

//Set timeout
setTimeout(function(){
	
	//Close the socket
	socket.close();
	
	//Make sure this process dies
	process.exit();
	
}, 200);
