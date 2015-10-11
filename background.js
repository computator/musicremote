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

//-------------------------------------------------------------------

function PlayerConnection(port) {
	this.port = port;
	this.player_found = false;

	this.onDisconnected = new EventDispatcher(this);
	this.onPlayerFound = new EventDispatcher(this);

	this.port.onDisconnect.addListener(this.handleDisconnect.bind(this));
	this.port.onMessage.addListener(this.handleMessage.bind(this));

	console.info("PlayerConnection created: ", this);
}

PlayerConnection.prototype.handleDisconnect = function () {
	console.info("PlayerConnection: Port disconnected: ", this.port);
	this.onDisconnected.dispatch();
	this.port = null;
}

PlayerConnection.prototype.disconnect = function () {
	console.info("PlayerConnection: Disconnecting port: ", this.port);
	this.port.disconnect();
	this.onDisconnected.dispatch();
	this.port = null;
}

PlayerConnection.prototype.protocolError = function (message) {
	if(message)
		console.warn("PlayerConnection: Invalid message from: ", this.port.sender, ": " + message);
	else
		console.warn("PlayerConnection: Invalid message from: ", this.port.sender);
	this.disconnect();
	return;
}

PlayerConnection.prototype.handleMessage = function (message) {
	console.info("PlayerConnection: Recieved message: ", message);
	if(!message.type)
		return this.protocolError();

	if(message.type == "init_player") {
		if(this.player_found)
			return this.protocolError("init_player can only be sent once");
		if(!message.name)
			return this.protocolError("init_player missing type");
		this.onPlayerFound.dispatch([new Player(this, message.name)]);
		this.player_found = true;
		return;
	}

	if(!this.player_found)
		return this.protocolError("init_player must be the first message");
}

PlayerConnection.prototype.sendCommand = function (command, args) {
	console.info("PlayerConnection: Sending command: ", command, args);
	this.port.postMessage({
			type: "command",
			command: command,
			args: args || null,
		});
}

//-------------------------------------------------------------------

function Player(connection, name) {
	this.connection = connection;
	this.name = name;

	this.state = {
			playing: false,
		};

	this.onDisconnected = new EventDispatcher(this);

	this.connection.onDisconnected.addListener(this.handleConnectionClosed.bind(this))

	console.info("Player created: ", this);
}

Player.prototype.handleConnectionClosed = function () {
	console.info("Player: Connection closed: ", this.connection);
	this.onDisconnected.dispatch();
	this.connection = null;
}

Player.prototype.play = function () {
	this.connection.sendCommand("play");
}

Player.prototype.pause = function () {
	this.connection.sendCommand("pause");
}

//-------------------------------------------------------------------

function PlayerManager() {
	this.player_connections = [];
	this.players = [];

	this.onPlayerAdded = new EventDispatcher(this);
	this.onPlayerRemoved = new EventDispatcher(this);
	console.info("PlayerManager created: ", this);
}

PlayerManager.prototype.addPlayerConnection = function (connection) {
	console.info("PlayerManager: Connection added: ", connection);
	this.player_connections.push(connection);

	connection.onPlayerFound.addListener(this.handlePlayerFound.bind(this));

	connection.onDisconnected.addListener(function () {
			console.info("PlayerManager: Connection removed: ", connection);
			this.player_connections.splice(this.player_connections.indexOf(connection), 1);
		}.bind(this));
}

PlayerManager.prototype.handlePlayerFound = function (player) {
	console.info("PlayerManager: Player found: ", player);
	this.players.push(player);

	player.onDisconnected.addListener(function () {
			console.info("PlayerManager: Player removed: ", player);
			this.players.splice(this.players.indexOf(player), 1);
			this.onPlayerRemoved.dispatch([player]);
		}.bind(this));
	this.onPlayerAdded.dispatch([player]);
}

PlayerManager.prototype.getPlayers = function () {
	return this.players.slice(); // return copy so our list is not modified
}

PlayerManager.prototype.getPlayersCount = function () {
	return this.players.length;
}

//-------------------------------------------------------------------

function ControllerServer(players) {
	this.players = players;
	this.server = null;

	players.onPlayerAdded.addListener(this.handlePlayerAdded.bind(this));
	players.onPlayerRemoved.addListener(this.handlePlayerRemoved.bind(this));
	console.info("ControllerServer created: ", this);
}

ControllerServer.prototype.handlePlayerAdded = function (player) {
	console.info("ControllerServer: Player added: ", player);
	if(!this.server)
		this.startServer();
}

ControllerServer.prototype.handlePlayerRemoved = function (player) {
	console.info("ControllerServer: Player removed: ", player);
}

ControllerServer.prototype.startServer = function () {
	console.info("ControllerServer: Starting server");
}

/////////////////////////////////////////////////////////////////////

var players = new PlayerManager();
var server = new ControllerServer(players);

console.info("Main: Binding events");

chrome.app.runtime.onLaunched.addListener(function () {
		chrome.app.window.create("instructions.html");
	});

chrome.runtime.onConnectExternal.addListener(function (port) {
		console.info("Main: Port connected: ", port);
		players.addPlayerConnection(new PlayerConnection(port));
	});