var childProcess = require("child_process");
var fs = require("fs");
var http = require('http');
var express = require("express");

//Load the config
var config = require("./config.json");
console.log(config);

//Create app server
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
server.listen(1337);

app.get('/', function(request, response){
	response.redirect('/cam/rockycam');
	return;
});

app.get('/cam/:slug', function(request, response){
	//Look for cams
	var camera = false;
	config.cameras.forEach(function(cam){
		if (cam.slug == request.params.slug) {
			camera = cam;
		}
	});

	//Check for no camera
	if (camera === false) {
		//Redirect
		response.redirect('/');

	} else {
		//Got a camera
		var template = htmlTemplate.toString("utf8");
		template = template.replace(/\{\{WIDTH\}\}/ig, camera.width);
		template = template.replace(/\{\{HEIGHT\}\}/ig, camera.height);
		template = template.replace(/\{\{SLUG\}\}/ig, camera.slug);
		template = template.replace(/\{\{NAME\}\}/ig, camera.name);
		response.send(template.toString("utf8"));
	}

	return;
});

//Load template
var webcamrcTemplate = fs.readFileSync(__dirname + "/webcamrc_template");

//Load html template
var htmlTemplate = fs.readFileSync(__dirname + "/template.html");

//Spawn each video capture
config.cameras.forEach(function(camera){
	//Create file
	var webcamrc = webcamrcTemplate.toString("utf8");
	webcamrc = webcamrc.replace("{{DEVICE}}", camera.device);
	webcamrc = webcamrc.replace("{{INPUT}}", camera.input);
	webcamrc = webcamrc.replace("{{FILE}}", camera.file);
	webcamrc = webcamrc.replace("{{WIDTH}}", camera.width);
	webcamrc = webcamrc.replace("{{HEIGHT}}", camera.height);

	//Set a camera image holding
	camera.image = null;

	//Camera process
	camera.process = null;

	//Output to file path
	var path = config.webcamrc.directory + camera.input;
	fs.writeFile(path, webcamrc, function(error){
		if (error) {
			console.log("Error with " + camera.name + ": ", error.stack);
		} else {
			console.log("Written webcamrc config file");
			
			//Spawn worker
			camera.process = childProcess.spawn('webcam', [path]);
			camera.process.stdout.on("data", function(data){
				console.log(camera.name + " stdout : " + data,toString());
			});
			camera.process.stderr.on("data", function(data){
				console.log(camera.name + " stderr : " + data,toString());
			});

			//Add file watcher for changes
			fs.watchFile(camera.file, function(current, previous){
				//Record the last update
				if (camera.lastUpdate === undefined || camera.lastUpdate < current.mtime.getTime()) {
					camera.lastUpdate = current.mtime.getTime();
					console.log("changed: ", current.mtime.getTime());
					//Might have to wait for the file to be fully written
					setTimeout(function(){
						//File changed so read the new image
						fs.readFile(camera.file, function(error, data){
							if (error) {
								console.log("Error with " + camera.name + " reading file: ", error.stack);
							} else {
								console.log("Read new file!");
								//Update camera image
								camera.image = data;

								//Broadcast changes!
								io.of('/' + camera.slug).emit('image', camera.image.toString("base64"));
								//fs.writeFileSync("/tmp/rockycam/img_.jpeg", camera.image);
							}

						});
					}, 300);
				}
			});

		}

	});

});