//File system
var fs = require("fs");

//Include zeromq
var zmq = require("zmq-3.0");

//Config
var config = require("./config.json");

//Read the arguments
var id = process.argv[2];
var watermarkPath = process.argv[3];
var imagePath = process.argv[4];

//Connect to zmq socket
var socket = zmq.createSocket('push');

//Connect to receive messages
var address = config.zeromq.protocol + '://' + config.zeromq.host + ':' + config.zeromq.port;
socket.connect(address);

//Execute the watermark
/*var childProcess = require("child_process");
var command = "composite -gravity SouthWest " + watermarkPath + " " + imagePath + " " + imagePath;
childProcess.exec(command,
function (error, stdout, stderr) {
	//Open file contents
	*/
	var image = fs.readFileSync(imagePath);

	//Broadcast
	socket.send(id, image);

	//Close
	socket.close();

	//Delete the original file
	fs.unlinkSync(imagePath);
/*
});
*/
//Kill self
setTimeout(function(){
	process.kill(process.pic, "SIGKILL");
}, 1000);

