//utilities
function randomIntBetween(a,b){return Math.floor(Math.random()*(b-a)+a);}//>=a, <b

function shuffle(array) {
	var currentIndex = array.length, temporaryValue, randomIndex;
	while (0 !== currentIndex) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}
	return array;
}
module.exports={
	exploration:{
		name:"Exploration Mode",
		info:"A shared world which you can move around, and shape or paint freely. There's no winning or losing.",
		abilities:[
			{
				name:"move",
				info:"move to a vertex adjacent to your position",
				conditions:["vertex","adjacent"],
				filter:"(obj=>(obj)&&(obj.type=='vertex')&&(localPlayer.position!=obj.id)&&(adjacent(localPlayer.position,obj.id)))",
				//the input gesture is always double click, and will only work if the condition is true, otherwise, the same input is tried with other abilities; this is how we can trigger move and connect in different contexts, because their conditions are mutually exclusive. abilities will be sent to the client, and the condition code is client-side, so we write it in quotes. the actual execution functions do not need to be sent.
				use:function(world,player,localPlayer,target){
					world.update(localPlayer,"position",target.id);
				}
			},
			{
				name:"connect",
				info:"connect your position with another non-adjacent vertex",
				filter:"(obj=>(obj)&&(obj.type=='vertex')&&(localPlayer.position!=obj.id)&&(!adjacent(localPlayer.position,obj.id)))",
				use:function(world,player,localPlayer,target){
					world.addEdge(localPlayer.position,target.id);
				}
			},
			{
				name:"delete edge",
				info:"delete an edge (target the edge)",
				filter:"obj=>((obj)&&(obj.type=='edge'))",
				use:function(world,player,localPlayer,target){
					world.deleteEdge(target.source,target.target);
				}
			},
		],
		menus:{
			//custom context menus will be show to players. the onChange functions are server-side and will not be passed. the client always uses the same mechanism ("change object"?) for all menu items. Kind of like affordances
			vertex:{
				label:{type:"string",onChange:function(world,player,obj,value){value=String(value);value.length=20;world.update(obj,"label",value);}},
				color:{type:"color",onChange:function(world,player,obj,value){world.update(obj,"color",value);}}
			}
		},
	},
	
	creative:{
		name:"Creative Mode",
		info:"Another shared world. Every player gets one connected component, where you can build anything you want without being disrupted by others. There's no winning or losing.",
		abilities:[
			{
				name:"move",
				info:"move to a vertex adjacent to your position",
				conditions:["vertex","adjacent"],
				filter:"(obj=>(obj)&&(obj.type=='vertex')&&(localPlayer.position!=obj.id)&&(adjacent(localPlayer.position,obj.id)))",
				//the input gesture is always double click, and will only work if the condition is true, otherwise, the same input is tried with other abilities; this is how we can trigger move and connect in different contexts, because their conditions are mutually exclusive. abilities will be sent to the client, and the condition code is client-side, so we write it in quotes. the actual execution functions do not need to be sent.
				use:function(world,player,localPlayer,target){
					world.update(localPlayer,"position",target.id);
				}
			},
			{
				name:"grow",
				info:"create a new adjacent vertex",
				filter:"(obj=>(!obj))",
				use:function(world,player,localPlayer,target){
					var v=world.addVertex();
					world.addEdge(localPlayer.position,v.id);
				}
			},
			{
				name:"bridge",
				info:"connect to a vertex within the same connected component",
				filter:"(obj=>(obj)&&(obj.type=='vertex')&&(localPlayer.position!=obj.id)&&(reachable(localPlayer.position,obj.id)))",
				use:function(world,player,localPlayer,target){
					world.addEdge(localPlayer.position,target.id);
				}
			},
			{
				name:"delete edge",
				info:"delete an edge within the same connected component(target the edge)",
				filter:"obj=>((obj)&&(obj.type=='edge')&&(reachable(localPlayer.position,obj.source)))",//tricky: since client and server-side represents edges differently (source as id vs source as object), the filter function needs to be written without referencing the source/target of edges directly, and use diffferent utility functions on both sides to achieve the same result. In this case, reachable() can work on both an id(assumed to be an vertex id) and an object on the client.
				use:function(world,player,localPlayer,target){
					world.deleteEdge(target.source,target.target);
				}
			},
		],
		menus:{
			//todo: filtering of menu usage
			vertex:{
				label:{type:"string",onChange:function(world,player,obj,value){value=String(value);value.length=20;world.update(obj,"label",value);}},
				color:{type:"color",onChange:function(world,player,obj,value){world.update(obj,"color",value);}}
			}
		},
		instanced:false//whether this world mode is shared or every player gets a new world to play(for puzzles etc)
	},
	
	/*
	survival:{
		name: "Survival Mode",
		info:"An alternative shared world, where you *are* a vertex and can shape your surroundings, and consume smaller vertices. Moves cost power and consuming vertces gain you power. If your location is deleted you lose the game.",
		abilities:[
			
		],
		
	},
	testing:{
		hidden:true,
		//a special place where we can test exotic and powerful new moves, like graph products, uploading/downloading, dealing with 3d models and whatever
	}
	*/
	hamiltonianCycle:{
		name:"Puzzle: Hamiltonian Cycle",
		info:"Find a Hamiltonian Cycle in this graph. Pass through all vertices just once and back to your starting location, within the edges given. Your path will be highlighted. If you think you made a mistake, you can retract some steps or just keep moving until you have walked in a complete cycle.",
		init:function(){//you really don't want to use the default init for this one! LOL
			var count=Math.floor(Math.random()*7)+7;//average 10; 16 seems way too hard
			var prob=(Math.random()*1+2)/count;//> 2 edges per vertex on average
			var verticesList=[];
			for(var i=0;i<count;i++)
			{
				verticesList.push(this.addVertex());
				for(var j=0;j<i;j++)
				{
					if(Math.random()<prob) {this.addEdge(verticesList[i].id,verticesList[j].id);}
				}
			}
			
			//just create a cycle to ensure there's a solution? use a random order so it can't be solved by looking at ids
			shuffle(verticesList);
			for(var i=0;i<count-1;i++)
			{
				if(!verticesList[i].edges[verticesList[i+1].id]){this.addEdge(verticesList[i].id,verticesList[i+1].id);}
			}
			if(!verticesList[count-1].edges[verticesList[0].id]){this.addEdge(verticesList[count-1].id,verticesList[0].id);}
		},
		onAddPlayer:function(player){
			var vlist=Object.keys(this.vertices);var vid=Math.floor(Math.random()*vlist.length);
			var v=this.vertices[vlist[vid]];
			player.position=v.id;this.update(v,"color",{h:v.color.h,s:0.7,v:0.8});//not using the default, to start with a highlighted vertex so players don't forget where they started out
		},//and definitely don't use the default here
		abilities:[
			{
				name:"move",//this is a single player mode, and we want to highlight used vertices. How/should we stop highlighting path that is too old (>n steps away)? for vertices it's not a problem, and we may not need to highlight edges after all
				info:"Move to an adjacent vertex. Your path will be colored. Go back to undo a step.",
				filter:"(obj=>(obj)&&(obj.type=='vertex')&&(adjacent(localPlayer.position,obj.id)))",
				use:function(world,player,localPlayer,target){
					//change the color, so that walked vertices light up
					var n=world.vertexCount();
					
					var currentVertex=world.vertices[localPlayer.position];
					var targetVertex=world.vertices[target.id];//target is a game object
					if((targetVertex.next)&&(targetVertex.next==localPlayer.position)){
						world.update(currentVertex,"color",{h:currentVertex.color.h,s:currentVertex.color.s/2,v:currentVertex.color.v});//decrease saturation to show that step is not used
					}//retract a step
					else{//change the color of the target based on the color of the current vertex; set next, and check for cycle
						world.update(targetVertex,"color",{h:(currentVertex.color.h+360/n)%360,s:0.6,v:0.6});
						world.update(currentVertex,"next",targetVertex.id);
						var map={};
						var v=currentVertex;var valid=true;
						for(var i=0;i<n;i++)
						{
							if(!v.next){valid=false;break;}//vertex IDs > 0
							v=world.vertices[v.next];
							if(map[v.id]){valid=false;break;}
							map[v.id]=true;
						}
						if(valid)
						{
							//win and exit the world
							console.log("player won in Hamiltonian Cycle!");
							player.client.emit("win","you have won the game!");//and then the player should exit when ready; do not kick people out
						}
					}
					world.update(localPlayer,"position",target.id);
				}
			}
		],
		menus:{
			//custom context menus will be show to players. the onChange functions are server-side and will not be passed. the client always uses the same mechanism ("change object"?) for all menu items. Kind of like affordances
			vertex:{
				label:{type:"string",onChange:function(world,player,obj,value){value=String(value);value.length=20;world.update(obj,"label",value);}}
				//to help them take notes?
			}
		},
		//on*** should detect wins and losses. todo: time-delayed effects and win/loss, like setting an interval
		instanced:true
	},
	
	minSpanningTree:{
		name:"Puzzle: Minimum Spanning Tree",
		info:"Build a minimum spanning tree in this graph with different edge costs (hover mouse to see the cost). Upgrade edges to make them light up, to connect all vertices with minimum cost. Tip: always choosing the least expensive edge that does not create a cycle will work.",
		init:function () {//uniformly sampled connected graph code adapted from an answer on SO
			var numNode=8, avgDegree=2;
			var vlist=[],S=[],T=[];
			
			for (var i = 0; i < numNode; i++) {
				var v=this.addVertex();
				vlist.push(v);
				S.push(v);
			}
			var currNodeIdx = randomIntBetween(0, S.length);
			var currNode = S[currNodeIdx];
			S.splice(currNodeIdx, 1);
			T.push(currNode);

			while (S.length > 0) {
				var neighbourNodeIdx = randomIntBetween(0, S.length);
				var neighbourNode = S[neighbourNodeIdx];
				this.addEdge(currNode.id,neighbourNode.id);
				
				S.splice(neighbourNodeIdx, 1);
				T.push(neighbourNode);
				currNode = neighbourNode;
			}

			// add random edges until avgDegree is satisfied
			while (this.edgeCount() / vlist.length < avgDegree/2) {
				var v1=vlist[randomIntBetween(0,vlist.length)];
				var v2=vlist[randomIntBetween(0,vlist.length)];
				if ((v1!=v2)&&(!(v2.id in v1.edges))) {
					this.addEdge(v1.id,v2.id);
				}
			}
			
			//then I actually need to know the correct minimum weight
			function MSTWeight(world)
			{
				var components={};for(var id in world.vertices){components[id]=id;}
				function unique(components){
					var x;
					for(var id in components){if(x){if(x!=components[id])return false;}else{x=components[id];}}
					return true;
				}
				var totalWeight=0;
				while(!unique(components)){
					var chosenEdge,minWeight=Infinity;
					for(var id in world.edges){
						var e=world.edges[id];
						if(components[e.source]==components[e.target])continue;
						if(e.brightness<minWeight){minWeight=e.brightness;chosenEdge=e;}
					}
					//merge the target component into the source one
					totalWeight+=chosenEdge.brightness;
					var targetComponent=components[chosenEdge.target];
					var sourceComponent=components[chosenEdge.source];
					for(var id in components){if(components[id]==targetComponent){components[id]=sourceComponent;}}
				}
				return totalWeight;
			}
			var answer=MSTWeight(this);
			this.getMSTWeight=function(){return answer;}//a function that will not be sent to the client
			
		},
		abilities:[
			{
				name:"move",//function moveTo
				info:"move to any vertex",
				filter:"obj=>(obj.type=='vertex')&&(localPlayer.position!=obj.id)",
				use:function(world,player,localPlayer,target){
					world.update(localPlayer,"position",target.id);
				}
			},
			{
				name:"upgrade",
				info:"light up an edge (target the edge)",
				filter:"obj=>((obj)&&(obj.type=='edge')&&(!obj.thickness))",
				use:function(world,player,localPlayer,target){
					world.update(target,"thickness",1);//thickness is a reserved property that controls edge thickness/brightness. length is affected by the length property but is ultimately decided by the layout
				}
			},
			{
				name:"restore",
				info:"undo upgrading an edge (target the edge)",
				filter:"obj=>((obj)&&(obj.type=='edge')&&(obj.thickness>0))",
				use:function(world,player,localPlayer,target){
					world.update(target,"thickness",0);//thickness is a reserved property that controls edge thickness/brightness. length is affected by the length property but is ultimately decided by the layout
				}
			}
			
		],
		onAddEdge:function(e){
			e.thickness=0;//link length is a bad visual indicator of weight, especially in 3D! but width is used for "selectedness" too...
			e.brightness=Math.floor(Math.random()*9+1)/10;//between 0 and 1. this doesn't change the link ribbon width, but makes it less bright
			e.length=e.brightness;//try to use length to help, as brightness/thickness is still confusing
			e.label=e.brightness.toString();
		},
		onUpdate:function(obj,key,value){
			if((obj.type=="edge")&&(key=="thickness")){
				//assuming all thickness>0 edges are the chosen tree
				obj=this.edges[obj.id];
				var world=this;
				var map={};var valid=true;//map contains ids of parents in the search tree
				function explore(i,parent,ignoredEdge){
					if(i in map){valid=false;return;}
					map[i]=parent;console.log("reached "+i+", parent is "+parent+", edges are to "+Object.keys(world.vertices[i].edges));
					for(var n in world.vertices[i].edges){
						console.log("thickness of edge to "+n+" is "+world.edges[world.vertices[i].edges[n]].thickness);
						if(world.vertices[i].edges[n]==ignoredEdge){console.log("ignoring edge to "+n);continue;}
						if((parent!=n)&&(world.edges[world.vertices[i].edges[n]].thickness>0))explore(n,i,ignoredEdge);
					}
					console.log("finished exploring "+i);
				}
				var totalWeight=0;for(var id in this.edges){if(this.edges[id].thickness>0){totalWeight+=this.edges[id].brightness;}}
				if(value>0)
				{
					//adding edge to the tree, test if the graph is covered by exploring both endpoints
					explore(obj.source,null);
					explore(obj.target,null);
					//add this edge
					totalWeight+=obj.brightness;
				}
				else{
					//deleting edge, explore ignoring this edge (assuming it's a spanning tree, only using one endpoint)
					explore(obj.source,null,obj.id);
					totalWeight-=obj.brightness;
				}
				
				console.log("chosen structure "+(valid?"is":"isn't")+" a tree, touched "+Object.keys(map).length+" of "+this.vertexCount()+ " vertices, weight is "+totalWeight+" and the best answer is "+this.getMSTWeight());
				if(valid&&(Object.keys(map).length==this.vertexCount())&&(totalWeight==this.getMSTWeight())){
					console.log("player won in MST!");
					this.broadcast("win","you have won the game!");
				}; 
			}
		},
		
		//win://
		instanced:true
	},
	isomorphism:{
		name:"Puzzle: Graph Isomorphism",
		info:"Given two isomorphic graphs, can you see the correspondence? Move around one set of vertices and connect every one to its oppositely colored counterpart.",
		init:function(){
			var count=Math.floor(Math.random()*3)+6;//want it to be smaller and denser than say MST
			var prob=(Math.random()*1+3)/count;
			var vlist=[],vlist2=[];
			var color1=Math.random()*360,color2=(color1+180)%360;//{h:,s:0.6,v:0.6};
			for(var i=0;i<count;i++)
			{
				vlist.push(this.addVertex());
				vlist2.push(this.addVertex());
				this.update(vlist[i],"color",{h:color1,s:0.6,v:0.6});
				this.update(vlist2[i],"color",{h:color2,s:0.6,v:0.6});
			}
			shuffle(vlist2);//so the ids don't give the answer
			for(var i=0;i<count;i++){
				for(var j=0;j<i;j++)
				{
					if(Math.random()<prob) {this.addEdge(vlist[i].id,vlist[j].id);this.addEdge(vlist2[i].id,vlist2[j].id);}
				}
			}
		},
		//default add palyer: place on any vertex
		abilities:[
			{
				name:"move",
				info:"Move to any same-colored vertex.",
				filter:"(obj=>(obj)&&(obj.type=='vertex')&&(localPlayer.position!=obj.id)&&(Math.abs(obj.color.h-world.vertices[localPlayer.position].color.h)<100))",
				use:function(world,player,localPlayer,target){
					world.update(localPlayer,"position",target.id);
				}
			},
			{
				name:"connect",
				info:"Connect to an corresponding vertex. Uniqueness will be enforced.",
				filter:"(obj=>(obj)&&(obj.type=='vertex')&&(!adjacent(localPlayer.position,obj.id))&&(Math.abs(obj.color.h-world.vertices[localPlayer.position].color.h)>100))",
				use:function(world,player,localPlayer,target){
					//delete all edges to differenly colored vertices from both the source and the target
					var source=world.vertices[localPlayer.position];
					for(var i in source.edges){
						if(Math.abs(source.color.h-world.vertices[i].color.h)>100){world.deleteEdge(source.id,i);}
					}
					for(var i in target.edges){
						if(Math.abs(target.color.h-world.vertices[i].color.h)>100){world.deleteEdge(target.id,i);}
					}
					var e=world.addEdge(localPlayer.position,target.id);
					world.update(e,"length",3);//such edges should look longer and be out of the way;
					world.update(e,"brightness",0.4);
					//check winning condition
					var valid=true;var map={};
					for(var i in world.vertices){
						var v=world.vertices[i];var mapped=false;
						for(var j in v.edges){
							if(Math.abs(v.color.h-world.vertices[j].color.h)>100){
								if(!mapped){mapped=true;map[i]=j;}
								else{valid=false;}
							}
						}
						if(mapped==false){valid=false;}
					}
					if(valid){
						for(var i in world.edges)
						{
							var e=world.edges[i];var source=world.vertices[e.source];var target=world.vertices[e.target];
							if(Math.abs(source.color.h-target.color.h)<100){//an original graph edge
								if(!(map[target.id] in world.vertices[map[source.id]].edges)){
									valid=false;
								}
							}
						}
						if(valid)
						{
							console.log("player won in Graph Isomorphism!");
							player.client.emit("win","you have won the game!");
						}
						
					}
				}
			}
		],
		menus:{
			//notes only
			vertex:{
				label:{type:"string",onChange:function(world,player,obj,value){value=String(value);value.length=20;world.update(obj,"label",value);}}
			}
		},
		instanced:true
	},
	/*
	colossalCave:{
		name:"Adventure: Colossal Cave",
		info:"Based on the classic text adventure game. Explore the cave and enjoy finally having a good map. Unfinished.",
		init:{
			var map={
				1: {name:"Road end",edges:[6]},
				2: {name:"Hill",edges:[1,5]},
				3: {name:"Building",edges:[]},//				Keys Lamp Bottle Food
				4: {name:"Valley",edges:[]},
				5: {name:"Forest with valley on side",edges:[]},
				6: {name:"Forest with valley & road",edges:[]},
				7: {name:"Slit in streambed",edges:[]},
				8: {name:"Outside grate",edges:[]},
				9: {name:"Below grate",edges:[]},
				10: {name:"Cobble crawl",edges:[]},//		Cage
				11: {name:"Debris room",edges:[]},//			Rod
				12: {name:"Sloping E/W canyon",edges:[]},
				13: {name:"Bird chamber",edges:[]},		//Bird
				14: {name:"Top of small pit",edges:[]},
				15: {name:"Hall of mists",edges:[]},
				17: {name:"Eastbank fissure",edges:[]},
				18: {name:"Gold room",edges:[]},			//Gold nugget
				19: {name:"Hall of Mt. King",edges:[]},
				23: {name:"West 2pit room",edges:[]},
				24: {name:"East pit",edges:[]},
				25: {name:"West pit",edges:[]},
				27: {name:"Westside fissure",edges:[]},		//Diamonds
				28: {name:"Low N/S passage",edges:[]},			//Silver bars
				29: {name:"Southside chamber",edges:[]},		//Jewelry
				30: {name:"Westside chamber",edges:[]},			//Coins
				33: {name:"Y2",edges:[]},
				34: {name:"Rock jumble",edges:[]},
				35: {name:"Window on pit",edges:[]},
				36: {name:"Dirty broken passage",edges:[]},
				37: {name:"Brink of clean pit",edges:[]},
				38: {name:"Pit with stream",edges:[]},
				39: {name:"Dusty rocks",edges:[]},
				41: {name:"Westend hall of mists",edges:[]},
				60: {name:"Eastend long hall",edges:[]},
				61: {name:"Westend long hall",edges:[]},
				62: {name:"High N/S passage",edges:[]},
				63: {name:"Dead end",edges:[]},
				64: {name:"Complex junction",edges:[]},
				65: {name:"Bedquilt",edges:[]},
				66: {name:"Swiss cheese",edges:[]},
				67: {name:"East 2pit room",edges:[]},
				68: {name:"Slab room",edges:[]},
				69: {name:"N/S canyon above room",edges:[]},
				70: {name:"N/S canyon above sizable passage",edges:[]},
				71: {name:"Three canyons junction",edges:[]},
				72: {name:"Low room",edges:[]},
				73: {name:"Deadend crawl",edges:[]},
				74: {name:"E/W canyon above tight canyon",edges:[]},
				75: {name:"Wide place in tight canyon",edges:[]},
				77: {name:"Tall E/W canyon with tight crawl",edges:[]},
				78: {name:"Mass of boulders",edges:[]},
				88: {name:"Narrow corridor",edges:[]},
				91: {name:"Steep incline above large room",edges:[]},
				92: {name:"Giant room",edges:[]},			//Eggs
				94: {name:"Immense N/S passage",edges:[]},
				95: {name:"Cavern with waterfall",edges:[]},	//	Trident
				96: {name:"Soft room",edges:[]},				//Pillow
				97: {name:"Oriental room",edges:[]},			//Vase
				98: {name:"Misty cavern",edges:[]},
				99: {name:"Alcove",edges:[]},
				100: {name:"Plover's room",edges:[]},			//Emerald
				101: {name:"Dark room",edges:[]},				//Tablet?
				102: {name:"Arched hall",edges:[]},
				103: {name:"Clam room",edges:[]},			//Clam/pearl
				104: {name:"Ragged corridor",edges:[]},
				105: {name:"Cul de sac",edges:[]},
				106: {name:"Anteroom",edges:[]},		//Magazines
				108: {name:"Witt's end",edges:[]},
				109: {name:"Mirror canyon",edges:[]},
				110: {name:"West window on pit",edges:[]},
				111: {name:"Top of stalactite",edges:[]},
				113: {name:"Reservoir",edges:[]},
				115: {name:"N/E end of repository",edges:[]},
				116: {name:"S/W end of repository",edges:[]},
				117: {name:"S/W of chasm",edges:[]},
				118: {name:"Sloping corridor",edges:[]},
				120: {name:"Dragon room",edges:[]},		//Rug
				122: {name:"N/E of chasm",edges:[]},
				123: {name:"Long E/W corridor",edges:[]},
				124: {name:"Fork in path",edges:[]},
				125: {name:"Warm walls junction",edges:[]},
				126: {name:"Breath-taking view",edges:[]},
				127: {name:"Chamber of boulders",edges:[]},		//Spices
				128: {name:"Limestone passage",edges:[]},
				129: {name:"Front of barren room",edges:[]},
				130: {name:"Bear cave",edges:[]},		//Chain
			};
		},
		abilities:[
			{
				name:"move",
				info:"move to a vertex adjacent to your position",
				conditions:["vertex","adjacent"],
				filter:"(obj=>(obj)&&(obj.type=='vertex')&&(localPlayer.position!=obj.id)&&(adjacent(localPlayer.position,obj.id)))",
				//the input gesture is always double click, and will only work if the condition is true, otherwise, the same input is tried with other abilities; this is how we can trigger move and connect in different contexts, because their conditions are mutually exclusive. abilities will be sent to the client, and the condition code is client-side, so we write it in quotes. the actual execution functions do not need to be sent.
				use:function(world,player,localPlayer,target){
					world.update(localPlayer,"position",target.id);
				}
			},
		]
	},
	*/
};
















