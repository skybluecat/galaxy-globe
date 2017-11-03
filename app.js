'use strict';
var worldTemplates=require("./worlds.js");
var http = require('http'),
	util = require("util"),
    io = require("socket.io"),
	express = require('express');
var app= express(),sio=io();
var server = http.createServer(app);
var port = process.env.PORT || 3000;
server.listen(port,server.address(),{'transports':[ 'websocket', 'flashsocket', 'polling' ]} );
sio.listen(server);
sio.sockets.on("connection", onSocketConnection);
console.log('\t :: Express :: Listening on '+server.address()+' port ' + port );
app.get( '/', function( req, res ){ 
console.log('request is:'+JSON.stringify(req.body));
	res.sendFile( __dirname + '/public/index.html' );
});
app.get( '/*' , function( req, res, next ) {
	var file = req.params[0]; 
	res.sendFile( __dirname + '/public/' + file );
}); 

//worlds
//use the menu to enter a new randomized world. worlds without players may be deleted.
var maxWorldID=0;
function worldPlayers(wid){return Object.keys(worlds[wid].players);}
var worldPrototype={//this is intended to be copied into every world; porperties that should not be shallow copied (eg. vertices) are added in the creation code

	playerCount:function(){return Object.keys(this.players).length},
	vertexCount:function(){return Object.keys(this.vertices).length},
	edgeCount:function(){return Object.keys(this.edges).length},
	
	getObj:function(obj)
	{
		switch(obj.type){
			case "vertex":return this.vertices[obj.id];break;
			case "edge":return this.edges[obj.id];break;
			case "player":return this.players[obj.id];break;
		}
	},
	
	
	broadcast:function(type,message){
		for(var p in this.players)
		{
			players[p].client.emit(type,message);
		}
	},
	broadcastExcept:function(type,message,ignored){
		for(var p in this.players)
		{
			if(p!=ignored){
				players[p].client.emit(type,message);
			}
		}
	},
	//it's not a good idea to log all changes to a world by default, as many objects are created in initialization. Better to log what players actually do and other stuff that is meaningful.
	addVertex:function(){//performs the action and announces it, checks basic consistency, but other conditions like mana should be handled by world-specific code, as it doesn't care who or what is responsible for the adding; it's called vertex because there's no visualization on the server side
		var id=this.maxVertexID+1;//real vertex ids are >=1
		var v={type:"vertex",id:id,edges:{},color:{}};//new vertices are not bright and have a hint of a random color
		setHSV(v.color,Math.random()*360,Math.random()*0.2,Math.random()*0.1);//the world can make changes or set new colors
		if(this.onAddVertex){
			var result=this.onAddVertex(v);
			if(result){console.log("adding vertex prevented because "+result);return;}
		}//the listening API is used before the fact; it returns truthy (a reason) to prevent the change, and nothing or falsey to allow it
		this.vertices[id]=v;this.maxVertexID++;
		this.broadcast("add",v);
		return v;
	},
	
	deleteVertex:function(id){
		if(!(id in this.vertices)){console.error("deleting vertex with wrong id "+id);return false;}
		//note, internal primitives with extra effects will logically need to call world-specific code again; like, if a vertex deletion causes edge deletion, this would have to call onEdgeDelete or something like that to make sure world logic stays consistent
		var v=this.vertices[id];var edges=v.edges;//todo: manage the world's total color if needed
		if(this.onDeleteVertex){var result=this.onDeleteVertex(v);if(result){console.log("deleting vertex prevented because "+result);return;}}//called before not after the fact because stuff may have changed to make after effects meaningless
		for(var target in edges)
		{
			this.deleteEdge(id,target);//this will broadcast it anyway, for consistency; client side forced deletion of edges should be avoided, because of on-deletion processing
		}
		delete this.vertices[id];
		this.broadcast("delete",v);
		return v;
	},
	
	addEdge:function(source,target)
	{//for now edges are undirected; they may need to have properties, so we use edge IDs (>=1) in the v.edges map, and have another edges map for the world if needed.
		var id=this.maxEdgeID+1;//real ids are >=1
		var e={type:"edge",id:id,source:source,target:target,length:1,width:1};//edges don't have their own colors but do have weights and lengths
		if(this.onAddEdge){var result=this.onAddEdge(e);if(result){console.log("adding edge prevented because "+result);return;}}
		this.vertices[source].edges[target]=id;  //cannot use cyclic references because we need to pass this vertices object to new players
		this.vertices[target].edges[source]=id;
		this.edges[id]=e;
		this.maxEdgeID++;
		//console.log("added edge between "+source+" and "+ target);
		this.broadcast("add",e);//todo: maxEdgeID will be unreliable on client side. how to mark this as something not to use? or should they update it?
		return e;
	},
	deleteEdge:function(source,target)
	{
		var e=this.edges[this.vertices[source].edges[target]];
		if(this.onDeleteEdge){var result=this.onDeleteEdge(e);if(result){console.log("deleting edge prevented because "+result);return;}}
		delete this.edges[this.vertices[source].edges[target]];
		delete this.vertices[source].edges[target];
		delete this.vertices[target].edges[source];
		this.broadcast("delete",e);
		return e;
	},
	addPlayer:function(playerID){
		//When a player tries to enter, he doesn't have a position, but he must have one after being added. So this must first ask onAddPlayer which returns falsey(and silently assigns a position to the object) to allow, or returns a reason to reject the player. actually this is not so different - the world can preprocess eg. vertices in onAdd* before they actually become part of the world.
		var player={type:"player",id:playerID};//tentative object
		if(this.onAddPlayer){var result=this.onAddPlayer(player);if(result){players[playerID].client.warn("cannot enter game because "+result);return;}}
		this.players[playerID]=player;players[playerID].world=this.id;
		this.broadcastExcept("add",player,playerID);//world.players is all public. Private stuff is in the global players map
		players[playerID].client.emit("enter world",this);//when someone enters a world, they are already in its players map.
		return player;
	},
	onAddPlayer:function(player){
			//in a shared world, usually you can just add an vertex; but in puzzles etc you don't want to do that
			if(this.instanced){
				var vlist=Object.keys(this.vertices);var vid=Math.floor(Math.random()*vlist.length);
				if(!vlist[vid])return "can't find a vertex to place the player on";
				var v=this.vertices[vlist[vid]];
				player.position=v.id;
			}
			else{
				var v=this.addVertex();
				if(v){player.position=v.id;return;}else{return "cannot create new vertex";}
			}
			
	},//default for some modes
	deletePlayer:function(id){
		util.log("player "+id+" was in world "+this.id +", removing them");
		if(this.onDeletePlayer){this.onDeletePlayer(this.players[id]);}//it's not possible for a game to refuse deleting a player. but if you don't like sudden disapperance, make an NPC take his place or something. Don't alter this player object's type or ID.
		this.broadcastExcept("delete",this.players[id],id);//this is intended for managing the client side graph, not for gameplay announcements, so if you need to say someone loses the game, do so in onDeletePlayer
		//the one being deleted presumably already left the game
		//update world?
		
	},
	update:function(obj, key,value)
	{//to perform and communicate most other game changes.
		if(this.onUpdate){var result=this.onUpdate(obj,key,value);if(result){console.log("change to "+obj.type +" #"+obj.id+" prevented because "+result);return;}}//this is an easy way to write programming-game style conditional triggers without having to put the same checks in multiple places
		obj=this.getObj(obj);//get the correct world reference, not the object from the socket
		//special case for colors, ugh
		//make sure to update the actual object in the world - this may get called carelessly for objects that aren't part of the world, like from the socket
		if((key=="color")&&(! ("r" in value))){var value2={};setHSV(value2,value.h||0,value.s||0,value.v||0);value=value2;}//don't want multiple references if the color object is reused
		console.log("updating "+key+" to "+ value);
		obj[key]=value;this.broadcast("update",{type:obj.type,id:obj.id,key:key,value:value});
		//console.log(obj);
	},
	//addGraph removed because it's too world-specific. Consistency requires calling world code that defeats the purpose of batch operation
	init:function(){
		//default example that should be overridden. expectation is 4096 vertices
		for(var subgraph=0;subgraph<64;subgraph++){//really want to avoid generating large hairballs, so I break it up into many smaller pieces that most likely looks better(and is faster in client code too)
			var count=Math.floor(Math.random()*13)+2;//average 8
			var prob=(Math.random()*0.1+1.8)/count;//< 2 edges per vertex on average
			var verticesList=[];
			for(var i=0;i<count;i++)
			{
				verticesList.push(this.addVertex());
				for(var j=0;j<i;j++)
				{
					if(Math.random()<prob){this.addEdge(verticesList[i].id,verticesList[j].id);}
				}
			}
			verticesList[0].color.s*=3;
		}
		console.log("created a world with "+this.vertexCount()+" vertices and "+this.edgeCount()+" edges");
	}
};
function createWorld(template)
{
	util.log("creating world with "+(template?"template "+template.name:"default template"));
	//todo: actually the template prototype should inherit a basic world prototype, and can override these standard methods. problem is, now the template is written as an object literal(to make writing methods easier) and can't really inherit anything. One workaround is manually copying all properties, as we don't expect the prototypes to change anyway
	var world={vertices:{},edges:{},players:{},maxVertexID:0,maxEdgeID:0};//color:{r:0,g:0,b:0}};
	Object.assign(world,worldPrototype);
	if(template){Object.assign(world,template);world.template=template.id;}
	maxWorldID++;worlds[maxWorldID]=world;world.id=maxWorldID;//can't do this before because templates have their own ids
	world.init();
	//sio.sockets.emit("add world",{id:maxWorldID,players:0});
	return world;
}
function removeWorld(wid)
{
	util.log("removing world "+wid);
	//sio.sockets.emit("remove world",{id:maxWorldID,players:worldPlayers(maxWorldID).length});
	delete worlds[wid];
}


var worlds={};
var players={};
//init persistent worlds first
for(var w in worldTemplates)
{
	var template=worldTemplates[w];
	template.id=w;//don't want to manually write them
	if(!template.instanced){
		template.worldID=createWorld(template).id;
	}
	for(var a in template.abilities)
	{
		template.abilities[a].id=a;
	}
}
function onSocketConnection(client) {
    util.log("New player has connected: "+client.id);
	players[client.id]={id:client.id,client:client};
	client.warn=function(str){this.emit("warning",str);console.log("warning player "+this.id+ ": "+str);}
    client.on("disconnect",function()
	{
		util.log("Player has disconnected: "+this.id);
		var w=players[this.id].world;
		if(w){worlds[w].deletePlayer(this.id);}
	});
	
	client.on("choose world", function(data){//choosing to enter a world
		//if(players[this.id].world){console.log("can't enter a game when the player already has one");return;}
		var template=worldTemplates[data];var wid;
		if(template.instanced){
			wid=createWorld(template).id;
		}
		else{wid=template.worldID;}
		worlds[wid].addPlayer(this.id);//it will send what's necessary
	});
	
	client.on("exit world", function(){
		util.log("player "+this.id+" leaves world");
		if(players[this.id].world){worlds[players[this.id].world].deletePlayer(this.id);}
		else{console.log("player is not in any world");}
		this.emit("choose world",worldTemplates);
	});

	client.on("use ability",function(data){
		var w=players[this.id].world;if(!w)return;
		var world=worlds[w];
		var localPlayer=world.players[this.id];
		var player=players[this.id];
		var ability=world.abilities[data.ability];
		if(!ability){this.warn("tried to use missing ability "+data.ability);return;}
		//I don't yet have an elegant way to generate a single filter function for all players and worlds, so here's one created on the fly
		//can't just let the user send whatever ability they want if they use the console.
		//todo: fix the abuse of eval and closures
		//here are the same internal functions and variables used in filtering as on the client
		function adjacent(a,b){return b in world.vertices[a].edges;}
		function reachable(start, end)
		{
			if(typeof start=="object"){start=start.id;}
			if(typeof end=="object"){end=end.id;}
			//DFS-based
			var map={};
			explore(world,start);
			function explore(world,i,cc){
				map[i]=true;
				for(var n in world.vertices[i].edges){if(!(map[n]))explore(world,n);}
			}
			if(map[end])return true; 
			else return false;
		}
		var func=eval(ability.filter);
		data.target=world.getObj(data.target);//get the correct world reference, not the object from the socket - important to check the ability on the real world object, not on untrusted stuff the client sent
		if(!func(data.target)){this.warn("invalid target for ability "+data.ability);return;}
		console.log("used ability "+data.ability+(data.target?(" on "+data.target.id):""));
		ability.use(world,player,localPlayer,data.target);
	});
	
	client.on("use menu",function(data){
		var w=players[this.id].world;if(!w)return;
		var world=worlds[w];
		var localPlayer=world.players[this.id];
		var player=players[this.id];
		var menu=world.menus[data.object.type][data.key];
		if(!menu){this.warn("tried to use nonexistent menu item "+data.key +"of type "+data.object.type);return;}
		menu.onChange(world,player,data.object,data.value);
	});
	client.on("eval",function(data){this.emit("test",eval(data));});
	//let them choose which world they want to enter

	console.log("asking them to choose a world");
	client.emit("choose world",worldTemplates);//contains names and descriptions of worlds; todo: support custom worlds that can be created multiple times from templates and also be joined by others
};
//now every world has some special rules, in the form of abilities written in code that are available to players.
//these will activate the corresponding JS code with the chosen target as input, which calls the primitive functions provided here, instead of having all different socket message types.
//even simple things like moving and coloring are special abilities now.


function hsv2rgb(hsv) {//copied from color space
	var h = hsv[0] / 60,
		s = hsv[1] / 100,
		v = hsv[2] / 100,
		hi = Math.floor(h) % 6;

	var f = h - Math.floor(h),
		p = 255 * v * (1 - s),
		q = 255 * v * (1 - (s * f)),
		t = 255 * v * (1 - (s * (1 - f)));
	v *= 255;

	switch(hi) {
		case 0:
			return [v, t, p];
		case 1:
			return [q, v, p];
		case 2:
			return [p, v, t];
		case 3:
			return [p, q, v];
		case 4:
			return [t, p, v];
		case 5:
			return [v, p, q];
	}
}

//coloring and labeling now only applies to the player's position, and is always available - not special abilities; and the input method is always the same, by changing things in the GUI(not clicking, which needs to be bound to special abilities)

function setHSV(color,h,s,v)//todo: if needed, update the total color of the world
{
	color.h=h;color.s=s;color.v=v;
	var tempc=hsv2rgb([h,s*100,v*100]);
	color.r=tempc[0];color.g=tempc[1];color.b=tempc[2];
}

function degree(v){return v.edges.length;}
function add(a,b){return a+b;}
function handSize(player)
{
	return Object.values(player.hand).reduce(add,0);
}
function gaussian(x, mean, variance)
{   var m = Math.sqrt(variance) * Math.sqrt(2 * Math.PI);
    var e = Math.exp(-Math.pow(x - mean, 2) / (2 * variance));
    return e / m;
}
function wrappedGaussian(x, mean, variance)
{
	//a function on 0-1 that has area under curve 1; used for scoring player's mana gain against local colors
	// p(x) = sum_k N(x + L*k; m, v)
    //      = a/(2*pi) + a/pi sum_{k=1}^inf cos(a*k*(x-m)) exp(-(a*k)^2 v/2) where a = 2*pi/L
	//translated to JS from some python
	if(variance<0.15*Math.pow(1/2/Math.PI,2))//??
	{
		//# use Gaussian summation formula
		var result = 0;
		for (var k=-1;k<=1;k++){
			//logp = Gaussian.GetLogProb(value + k*Period)
            //# result = MMath.LogSumExp(result, logp)
            result+=gaussian(x + k, mean, variance);
		}
        return result;
	}
	else
	{
		//Using cosine formula
		var result = 0.5,aOverPi = 2.0/1,a = aOverPi * Math.PI,diff = x - mean,vHalf = variance * 0.5;
		for(var k=1;k<=8;k++)
		{
			var ak = a*k;
			result += Math.cos(ak*diff) * Math.exp(-ak*ak*vHalf);
		}
		return result * aOverPi;
	}
}

function numericalIntegration()
{
	//simply verifying the density function
	var sum=0;for(var i=0;i<1000;i++){sum+=wrappedGaussian(i/1000,0.5,0.04)*0.001;}
	return sum;
}

function hueDistance(a,b)
{
	var diff=Math.abs(b-a)%256;
	if(diff>128)diff=256-diff;
	return diff;
}
function distanceScoringFactor(d)
{return Math.exp(-d/10);}
function score(player)
{
	//assume all cards have a map of colors(hue an "intensity" value that affects display brightness and saturation by mixing different hues)
	var world=worlds[player.worldID];var hand=player.hand;var v=world.vertices[player.position];
	
	//if(card in hand)return card*(hand[card]/handSize(player)); else return 0;
	
	var total=0;
	for(var card in hand)//0 to 255?
	{//??
		for(var c in v.colors)
		{
			total += v.colors[c]*(hand[card]/handSize(player))*distanceScoringFactor(hueDistance(c,card));
		}
		
	}
	return total;
}

