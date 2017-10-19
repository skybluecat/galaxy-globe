'use strict';
var http = require('http'),
	util = require("util"),
    io = require("socket.io"),
	express = require('express');
var app= express(),sio=io();
var server = http.createServer(app);
var realPort=8080;
server.listen(realPort,server.address(),{'transports':[ 'websocket', 'flashsocket', 'polling' ]} );
sio.listen(server);
sio.sockets.on("connection", onSocketConnection);
console.log('\t :: Express :: Listening on '+server.address()+' port ' + realPort );
app.get( '/', function( req, res ){ 
console.log('request is:'+JSON.stringify(req.body));
	res.sendFile( __dirname + '/public/index.html' );
});
app.get( '/*' , function( req, res, next ) {
	var file = req.params[0]; 
	res.sendFile( __dirname + '/public/' + file );
}); 
app.post('/',function(req,res){
	console.log('request is:'+JSON.stringify(req.body));
});

//worlds
//now we just make everybody share the same world
var maxWorldID=0;
function worldPlayers(wid){return Object.keys(worlds[wid].players);}
function createWorld()
{
	util.log("creating world");
	maxWorldID++;worlds[maxWorldID]={id:maxWorldID,nodes:{},players:{},maxNodeID:0,color:{r:0,g:0,b:0}};//here the color values have no limits, not 255
	randomInitWorld(worlds[maxWorldID]);
	//sio.sockets.emit("add world",{id:maxWorldID,players:0});
}
function removeWorld(wid)
{
	util.log("removing world "+wid);
	//sio.sockets.emit("remove world",{id:maxWorldID,players:worldPlayers(maxWorldID).length});
	delete worlds[wid];
}
function randomInitWorld(world)
{
	var count=Math.floor(Math.random()*200);
	var prob=(Math.random()*1+1)/count;
	var nodesList=[];
	for(var i=0;i<count;i++)
	{
		nodesList.push(addNode(world));
		for(var j=0;j<i;j++)
		{
			if(Math.random()<prob)addLink(world,nodesList[i].id,nodesList[j].id);
		}
	}
}
var worlds={};createWorld();addNode(worlds[1]);
var players={};
function onSocketConnection(client) {
    util.log("New player has connected: "+client.id);
	players[client.id]={id:client.id,client:client};
    client.on("disconnect",function()
	{
		util.log("Player has disconnected: "+this.id+" found:"+(this.id in players));
		var w=players[this.id].world;
		if(w)//player is in a game/world; only opponents in that world can see the remove player message
		{		
			util.log("player "+this.id+" was in world "+w +", removing them");
			for(var otherPlayer in worlds[w].players)
			{
				if(otherPlayer!=this.id){players[otherPlayer].client.emit("remove player",{id:this.id});}
			}//but everyone, including opponents can see that this world has one less player
			delete worlds[w].players[this.id];
			//this.broadcast.emit("update world", {id: w,value:worldPlayers(w).length});
		}
		delete players[this.id];
	});
//enter the default game automatically
	worlds[1].players[client.id]={id:client.id,power:10};players[client.id].world=1;client.emit("enter world",worlds[1]);
	
	client.on("color node",function(data){
		var w=players[this.id].world;if(!w)return;
		//if(worlds[w].players[this.id].power>0){worlds[w].players[this.id].power--;}else{return;}
		if(!(data.id in worlds[w].nodes)){console.log("tried to color missing node "+data.id);return;}
		colorNode(worlds[w],data);console.log("color node "+data.id);
		for(var p in worlds[w].players)
		{
			players[p].client.emit("color node",data);
		}
	});
	
	client.on("label node",function(data){
		var w=players[this.id].world;if(!w)return;
		//if(worlds[w].players[this.id].power>0){worlds[w].players[this.id].power--;}else{return;}
		if(!(data.id in worlds[w].nodes)){console.log("tried to color missing node "+data.id);return;}
		labelNode(worlds[w],data);console.log("label node "+data.id+" as "+data.text);
		for(var p in worlds[w].players)
		{
			players[p].client.emit("label node",data);
		}
	});
	
	client.on("label link",function(data){
		//??
	});
	
	
	client.on("add node",function(data){
		var w=players[this.id].world;if(!w)return;
		//if(worlds[w].players[this.id].power>0){worlds[w].players[this.id].power--;}else{return;}
		var n=addNode(worlds[w]);console.log("added node id "+n.id);
		for(var p in worlds[w].players)
		{
			players[p].client.emit("add node",n);//players[p].client.emit("update player",worlds[w].players[this.id]);
		}
	});
	client.on("delete node",function(data){
		var w=players[this.id].world;if(!w)return;
		//if(worlds[w].players[this.id].power>0){worlds[w].players[this.id].power--;}else{return;}
		if(!(data in worlds[w].nodes)){console.log("tried to delete missing node "+data);return;}
		deleteNode(worlds[w],data);console.log("deleted node id "+data);
		for(var p in worlds[w].players)
		{
			players[p].client.emit("delete node",data);//players[p].client.emit("update player",worlds[w].players[this.id]);
		}
	});
	client.on("add link",function(data){
		var w=players[this.id].world;if(!w)return;
		//if(worlds[w].players[this.id].power>0){worlds[w].players[this.id].power--;}else{return;}
		if(!(data.source in worlds[w].nodes)){console.log("tried to add link to missing node "+data.source);return;}
		if(!(data.target in worlds[w].nodes)){console.log("tried to add link to missing node "+data.target);return;}
		addLink(worlds[w],data.source,data.target);console.log("add link "+data.source+","+data.target);
		for(var p in worlds[w].players)
		{
			players[p].client.emit("add link",data);//players[p].client.emit("update player",worlds[w].players[this.id]);
		}
	});
	client.on("delete link",function(data){
		var w=players[this.id].world;if(!w)return;
		//if(worlds[w].players[this.id].power>0){worlds[w].players[this.id].power--;}else{return;}
		if(!(data.source in worlds[w].nodes)){console.log("tried to delete link to missing node "+data.source);return;}
		if(!(data.target in worlds[w].nodes)){console.log("tried to delete link to missing node "+data.target);return;}
		deleteLink(worlds[w],data.source,data.target);console.log("delete link "+data.source+","+data.target);
		for(var p in worlds[w].players)
		{
			players[p].client.emit("delete link",data);//players[p].client.emit("update player",worlds[w].players[this.id]);
		}
	});
	
	
	
};
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

function colorNode(world,data){//here the values are 0-255, as in the color-space library
	var n=world.nodes[data.id];
	if(n.color)
	{
		world.color.r-=n.color.r;world.color.g-=n.color.g;world.color.b-=n.color.b;
	}
	n.color.hue=data.h;
	n.color.saturation=data.s;
	n.color.value=data.v;
	var newColor=hsv2rgb([data.h,data.s*100,data.v*100]);
	world.color.r+=newColor[0];world.color.g+=newColor[1];world.color.b+=newColor[2];
	n.color.r=newColor[0];n.color.g=newColor[1];n.color.b=newColor[2];
}

function labelNode(world,data){//just some plain text; limited to 25 characters?
	var n=world.nodes[data.id];
	n.text=data.text;
}
function addNode(world)
{
	world.maxNodeID++;var id=world.maxNodeID;
	var temp={id:id,links:{},color:{hue:Math.random()*360,saturation:Math.random()*0.2,value:Math.random()*0.1,}};//new nodes are not bright and have a hint of a random color
	var color=hsv2rgb([temp.color.hue,temp.color.saturation*100,temp.color.value*100]);
	temp.color.r=color[0];temp.color.g=color[1];temp.color.b=color[2];
	world.nodes[id]=temp;
	return temp;
}
function deleteNode(world,id)
{
	if(!(id in world.nodes)){console.error("deleting node with wrong id "+id);return;}
	var n=world.nodes[id];var l=n.links;
	if(n.color)
	{
		world.color.r-=n.color.r;world.color.g-=n.color.g;world.color.b-=n.color.b;
	}
	for(var target in l)
	{
		delete world.nodes[target].links[id]; 
		//if(id<target){delete links[id+"-"+target];}
		//else{delete links[target+"-"+id];}
		util.log("forced deletion of an edge to "+target);
	}
	delete world.nodes[id];
}
function addLink(world,id,target)
{
	world.nodes[id].links[target]=true;  //cannot use cyclic references because we need to pass this nodes object to new players //world.nodes[target];
	world.nodes[target].links[id]=true;
	//if(id<target){links[id+"-"+target]={source:nodes[id],target:nodes[target]};}
	//else{links[target+"-"+id]={source:nodes[target],target:nodes[id]};}
	
}
function deleteLink(world,id,target)
{
	delete world.nodes[id].links[target];
	delete world.nodes[target].links[id];
	//if(id<target){delete links[id+"-"+target];}
	//else{delete links[target+"-"+id];}
}
function degree(v){return v.links.length;}
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
/*
            if self._variance < 0.15 * pow(self._period / 2 / np.pi, 2):
                # use Gaussian summation formula
                if verbose:
                    print('Using Gaussian summation formula')
                result = 0 #-np.infty;
                for k in xrange(-1,1):
                    # logp = Gaussian.GetLogProb(value + k*Period)
                    # result = MMath.LogSumExp(result, logp)
                    tmp = norm.pdf(x + k*self._period, self._mean, self._variance)
                    #print(tmp.min(), tmp.max())
                    result += tmp
                return result
            else:
                if verbose:
                    print('Using cosine formula')
                # v >= 0.15
                # use the cosine formula
                result = 0.5
                aOverPi = 2.0 / self._period
                a = aOverPi * np.pi
                diff = x - self._mean
                vHalf = self._variance * 0.5
                for k in xrange(1,8):
                    ak = a*k
                    result += np.cos(ak*diff) * np.exp(-ak*ak*vHalf)
                #print(result, aOverPi, self._period)
                return result * aOverPi
*/
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
	var world=worlds[player.worldID];var hand=player.hand;var v=world.nodes[player.position];
	
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

//Aplayers are bound to want to create patterns with different colors and keep different colors in their hand, simply because they ike different colors, and different colors may be pleasant to the same players but not oters
// encourage players who like the same colors work or paint together
//nobody wants their graph to be too dark. How about brightness dependent on player activity - if you are inactive or the place is too lonely it gets dark? Or, everything is dark or black by default, and players create light? (What if you need some parts dark for artistic reasons?)

//Disable automatic blending or make sure they only expand for one step unless the target vertex has no color. How about - nodes can seep mana into edges but edges can't into nodes unless the nodes are empty?

//if allowing people to label stuff with text, some kind of visual story or joourny can be easily represented, but I would like interactivity so better put that off until items, monsters, automatic triggers etc work.
//against vandalism. able to save subgraphs as templates that can be copied and reconstructed easily later

//players should gain mana based on colors on vertices but should not actually absorb or disrupt the colors, to avoid needless inconveniences in painting.