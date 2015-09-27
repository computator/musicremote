var player_connections = [];


function EventDispatcher(context) {
	this.handlers = [];
	this.context = context;
}

EventDispatcher.prototype.addListener = function (handler) {
	if(this.handlers.indexOf(handler) === -1)
		this.handlers.push(handler);
}

EventDispatcher.prototype.removeListener = function (handler) {
	var offset;
	if((offset = this.handlers.indexOf(handler)) !== -1)
		this.handlers.splice(offset, 1);
}

EventDispatcher.prototype.dispatch = function (args) {
	args = args || [];
	return this.handlers.some(function (handler) {
			return handler.apply(this.context, args) === false;
		});
}


function PlayerConnection(port) {
	this.port = port;
	this.onDisconnected = new EventDispatcher(this);

	this.port.onDisconnect.addListener(this.handleDisconnect.bind(this));
	this.port.onMessage.addListener(this.handleMessage.bind(this));
}

PlayerConnection.prototype.handleDisconnect = function () {
	this.onDisconnected.dispatch();
	this.port = null;
}

PlayerConnection.prototype.handleMessage = function (message) {
	console.log(message);
}


chrome.app.runtime.onLaunched.addListener(function () {
		chrome.app.window.create("instructions.html");
	});

chrome.runtime.onConnectExternal.addListener(function (port) {
		var connection = new PlayerConnection(port);
		player_connections.push(connection);
		connection.onDisconnected.addListener(function () {
				player_connections.splice(player_connections.indexOf(connection), 1);
			});
	});