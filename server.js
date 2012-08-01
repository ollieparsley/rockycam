var childProcess = require("child_process");
var fs = require("fs");
var http = require('http');
var express = require("express");

//Load the config
var config = require("./config.json");
console.log(config);

//Create app server
var app = express.createServer();
var io = require('socket.io').listen(1338);
io.set('log level', 1);
io.set('transports', ['websocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);

function setupTemplate(html, camera) {
	html = html.replace(/\{\{HOST\}\}/ig, config.socket.host);
	html = html.replace(/\{\{PORT\}\}/ig, config.socket.port);

	if (camera !== undefined) {
		html = html.replace(/\{\{WIDTH\}\}/ig, camera.width);
		html = html.replace(/\{\{HEIGHT\}\}/ig, camera.height);
		html = html.replace(/\{\{ID\}\}/ig, camera.id);
		html = html.replace(/\{\{NAME\}\}/ig, camera.name);
	}

	var camerasLi = '';
	var camerasNav = '';
	var cameraIdsArray = '';
	var count = 0;
	config.cameras.forEach(function(camera){
		if (count > 0) {
			cameraIdsArray += ','
		}
		cameraIdsArray += "'" + camera.id + "'";
		camerasLi += '<li><h2><a href="/cam/' + camera.id + '">' + camera.name + ' camera</a></h2><div class="cameraSurround"><img class="camera" id="camera_' + camera.id + '" src="" /><img class="watermark" src="/images/watermark.png" /></div></li>';
		camerasNav += '<li><a href="/cam/' + camera.id + '">' + camera.name + ' camera</a></li>';
		count++;
	});
	html = html.replace(/\{\{CAMERAS\}\}/ig, camerasLi);
	html = html.replace(/\{\{CAMERAS_NAV\}\}/ig, camerasNav);
	html = html.replace(/\{\{CAMERAS_ARRAY\}\}/ig, cameraIdsArray);

	return html;
}

//Listen on http port
app.listen(config.http.port);

//Use static files
var maxAge = 60 * 60 * 6 * 1000; //6 hours
app.use(express.static(__dirname + '/public', { maxAge: maxAge }));

//Index page
app.get('/', function(request, response){
	var html = setupTemplate(htmlIndexTemplate.toString("utf8"));
	response.send(html);
});

app.get('/cam/:slug', function(request, response){
	//Look for cams
	var camera = false;
	config.cameras.forEach(function(cam){
		if (cam.id == request.params.slug) {
			camera = cam;
		}
	});

	//Check for no camera
	if (camera === false) {
		//Redirect
		response.redirect('/');

	} else {
		//Got a camera
		var html = setupTemplate(htmlTemplate.toString("utf8"), camera);
		response.setHeader('Cache-Control', 'max-age=' + parseInt(maxAge / 1000));
		response.send(html);
	}

	return;
});

//Load template
var motionThreads = "";
var motionConfigTemplate = fs.readFileSync(__dirname + "/motion/motion.conf");

//Load html template
var htmlTemplate = fs.readFileSync(__dirname + "/templates/cam.html");
var htmlIndexTemplate = fs.readFileSync(__dirname + "/templates/index.html");

//Spawn each video capture
config.cameras.forEach(function(camera){
	
	setTimeout(function(){

		//Create file
		var directory = config.motion.directory + '_' + camera.id;
		var motionConfig = motionConfigTemplate.toString("utf8");
		motionConfig = motionConfig.replace(/\{\{DEVICE\}\}/ig, camera.device);
		motionConfig = motionConfig.replace(/\{\{ID}}/ig, camera.id);
		motionConfig = motionConfig.replace(/\{\{DIRECTORY}}/ig, directory);
		motionConfig = motionConfig.replace(/\{\{WIDTH}}/ig, camera.width);
		motionConfig = motionConfig.replace(/\{\{HEIGHT\}\}/ig, camera.height);
		motionConfig = motionConfig.replace(/\{\{FPS\}\}/ig, camera.fps);
		motionConfig = motionConfig.replace(/\{\{PALETTE\}\}/ig, camera.palette);

		//Set a camera image holding
		camera.image = null;

		//Camera process
		camera.process = null;

		//Listen for new socket connections
		io.of('/' + camera.id).on('connection', function (socket) {
			if (camera.image !== null) {
				socket.emit('image', camera.image.toString("base64"));
			}
		});

		//Output to file path
		var path = config.motion.directory + "_" + camera.id + ".conf";

		//Write config file
		fs.writeFile(path, motionConfig, function(error){
			if (error) {
				console.log("Error with " + camera.name + ": ", error.stack);
			} else {
				console.log("Written " + camera.name + " motion config file");

				console.log("Spawning " + camera.name + " motion process");

				//Regex
				var regex = new RegExp("(" + directory.toString().replace("/", "\/") + "\/.*\.jpg)" ,"igm");

				//Start a new child motion process
				camera.process = childProcess.spawn('motion', ["-c", path]);
				camera.process.stdout.on("data", function(data){
					//Process the stdout messages
					console.log("Motion stdout : " + data.toString());
				});
				camera.process.stderr.on("data", function(data){
					//(\/tmp\/motion\/.*\.jpg)
					try {
						var matches = regex.exec(data.toString("utf8"));
						if (matches !== null && matches.length !== undefined && matches.length > 0) {

							//Image path
							var imagePath = matches[0];

							//Read the file
							console.log("Reading: " + imagePath);
							fs.readFile(imagePath, function(error, data){
								if (error) {
									console.log("Error reading file " + imagePath, error.message, error.stack);
								} else {
									//Store camera image
									camera.image = data;

									//Send to client
									io.of('/' + camera.id).emit('image', camera.image.toString("base64"));

									//Delete the original file
									fs.unlinkSync(imagePath);

								}
							});
						} else {
							console.log("Motion stderr null: " + data.toString("utf8"));
						}
					} catch (e) {
						console.log("Motion stderr exception: " + data.toString("utf8"));
					}

				});

			}
		});
	
	}, (30000 * (camera.id - 1)));
	
});
