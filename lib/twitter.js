//Native libs
var util = require('util');
var events = require('events');
var OAuth = require('./oauth.js').OAuth;

/** 
 * Creates Special instance
 *
 * @param clients  Clients The Clients object
 * 
 * @returns Client
 */
function Twitter(options) {
    events.EventEmitter.call(this);
  
    //Options
    this.options = options;
	
	//Consumer
	this.consumer = new OAuth("https://twitter.com/oauth/request_token",
		"https://twitter.com/oauth/access_token",
		this.options.consumerKey,
		this.options.consumerSecret,
		"1.0A",
		"http://ollieparsley.com",
		"HMAC-SHA1");

}
util.inherits(Twitter, events.EventEmitter);

Twitter.prototype.getUserDetails = function(callback){
	this.consumer.get("http://api.twitter.com/1/account/verify_credentials.json", this.options.accessToken, this.options.accessTokenSecret, function(error, data) {
		callback(JSON.parse(data));
	}.bind(this));
}

Twitter.prototype.tweet = function(text, callback){
	this.consumer.post("http://api.twitter.com/1/statuses/update.json", this.options.accessToken, this.options.accessTokenSecret, {status: text}, false, function(error, data) {
		callback(JSON.parse(data));
	}.bind(this));
}


module.exports = Twitter;