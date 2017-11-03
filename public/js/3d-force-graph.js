//heavily modified from 3d-force-graph, from the author of d3-forcelayout-3d
//note: the intended effect is that nodes mostly form layers of a sphere (assuming the graph is mostly sparse and disconnected, which is probably true for multi-user hand-made graphs), where high degree nodes (and denser subgraphs) are nearer the center and low degree ones are at the outside. High degree nodes get more inward radial force which pulls them towards the smallest possible layer that can fit all nodes (so the radius is proportional to the square root of the graph order, and in the limit of infinite degree, stuff just fit into a layer as small as possible rather than being squeezed at the center). When heavy nodes have lighter nodes attached, they may rise as a whole (so average degree is what matters).
//a degree-layer's thickness should be correlated with the number or proportion of the nodes of that degree.
//contains game mechanics-related stuff, like gesture filtering

var CAMERA_DISTANCE2NODES_FACTOR = 150;
var clock = new THREE.Clock();
const scene = new THREE.Scene();
//has a nodes and a links object, plus other objects like star background
const graph3d = {scene:scene};

var glowMap = new THREE.ImageUtils.loadTexture('images/glow.png');
var particleMap = new THREE.ImageUtils.loadTexture('images/particle.png');

//init the scene once, but scenes may be reset as player enters new worlds
function init3d(domElement) {
    var navInfo;
	graph3d.domElement=domElement;
    domElement.appendChild(navInfo = document.createElement('div'));
    navInfo.className = 'graph-nav-info';
    navInfo.textContent = "MOVE mouse & press LEFT/A: rotate, MIDDLE/S: zoom, RIGHT/D: pan";
	
	domElement.appendChild(graph3d.exitButton = document.createElement('div'));
    graph3d.exitButton.className = 'exit-button';graph3d.exitButton.textContent="Exit world";
    graph3d.exitButton.onclick = ()=>socket.emit("exit world");
	
	
    domElement.appendChild(graph3d.logElem = document.createElement('div'));
    graph3d.logElem.className = 'graph-logs';
	
	domElement.appendChild(graph3d.contextElem = document.createElement('div'));
    graph3d.contextElem.className = 'context-menu';
	
    const toolTipElem = document.createElement('div');graph3d.tooltipElem=toolTipElem;
    toolTipElem.classList.add('graph-tooltip');
    domElement.appendChild(toolTipElem);
	
	graph3d.addLog=function(msg){
		var p=document.createElement('p');p.textContent=msg;p.className = 'graph-log';
		graph3d.logElem.appendChild(p);p.createTime=new Date().getTime();
	};

    const raycaster = new THREE.Raycaster();raycaster.params.Points.threshold=2;//todo:set this to the best value adaptively
	graph3d.raycaster=raycaster;
	
    const mousePos = new THREE.Vector2();graph3d.mousePos=mousePos;
    const mouseScreenPos = new THREE.Vector2();graph3d.mouseScreenPos=mouseScreenPos;
    mousePos.x = -2;
    // Initialize off canvas
    mousePos.y = -2;
    domElement.addEventListener("mousemove", ev=>{
		
        const offset = getOffset(domElement)
          , relPos = {
            x: ev.pageX - offset.left,
            y: ev.pageY - offset.top
        };
		mousePos.x = ( event.clientX / domElement.clientWidth ) * 2 - 1;
		mousePos.y = - ( event.clientY / domElement.clientHeight ) * 2 + 1;
		mouseScreenPos.x=event.clientX;
		mouseScreenPos.y=event.clientY;
        //mousePos.x = ((relPos.x / domElement.clientWidth) * 2 - 1);
        //mousePos.y = -(relPos.y / domElement.clientHeight) * 2 + 1;
        toolTipElem.style.top = (relPos.y - 40) + 'px';
        toolTipElem.style.left = (relPos.x - 20) + 'px';

		var alpha=graph3d.d3ForceLayout.alpha();
		if(graph3d.getObjectAtPos(mousePos)){graph3d.d3ForceLayout.alpha(alpha*0.97);}//slowly pause the moving stuff so players can click easily
        else{graph3d.d3ForceLayout.alpha(alpha+0.005>1?1:alpha+0.005);}
		
	
        function getOffset(el) {
            const rect = el.getBoundingClientRect()
              , scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
              , scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            return {
                top: rect.top + scrollTop,
                left: rect.left + scrollLeft
            };
        }
    }
    , false);

    window.addEventListener("resize", resizeCanvas, false);
    // Handle click events on nodes ; click to select node
    var mouseDownPos = {
        x: -1,
        y: -1
    };
	
	graph3d.getObjectAtPos=function(pos){
		raycaster.setFromCamera(pos, graph3d.camera);
		if(!graph3d.nodes)return;//,graph3d.links,graph3d.players)
		if(!graph3d.world)return;
		var intersectList=[graph3d.nodes,graph3d.links,graph3d.players];
		const intersects = raycaster.intersectObjects(intersectList);
        if (intersects.length) {
			var bestObj;var bestDistance=10000;var vector=new THREE.Vector3();
			for(var i=0;i<intersects.length;i++)
			{
				var distance;
				if(intersects[i].object==graph3d.nodes){
					//vector.copy(intersects[i].point);vector.multiplyScalar(-1);
					//vector.add(graph3d.world.vArray[intersects[i].index]);
					distance=intersects[i].distanceToRay;//vector.length();
					if(distance<bestDistance){bestDistance=distance;bestObj=graph3d.world.vArray[intersects[i].index];}
				}
				else if(intersects[i].object==graph3d.links){
					var e=graph3d.world.eArray[Math.floor(intersects[i].faceIndex/6)];//faceIndex is the index of the first vertex?
					//try a simpler way as links are rather narrow
					distance=1;//and prioritize clicking nodes over links, as it's too easy to click on a node and also intersect its incident links.
					if((distance<bestDistance)&&((!bestObj)||(bestObj.type!="vertex"))){bestDistance=distance;bestObj=graph3d.world.eArray[Math.floor(intersects[i].faceIndex/6)];}
				}
				else{
					//currently we don't want to select players, as long as they don't have separate positions from vertices
					//
				}
			}
			//console.log("clicked "+bestObj.type+" "+bestObj.id+((bestObj.type=="edge")?": from "+bestObj.source.id+" to "+bestObj.target.id:""));
			return bestObj;
		}
	};
    domElement.addEventListener("mousedown", ev=>{
        mouseDownPos.x = mousePos.x;
        mouseDownPos.y = mousePos.y;
		//todo: start dragging if clicked, and stop camera moving
    });
    domElement.addEventListener("mouseup", ev=>{
        if ((graph3d.world) && (graph3d.onclick) && (mouseDownPos.y == mousePos.y) && (mouseDownPos.x == mousePos.x)) {
            const target=graph3d.getObjectAtPos(mouseDownPos);
            if (target) {
                if (ev.button == 0) {
                    graph3d.onclick(target);
                }
                if (ev.button > 0) {
                    graph3d.onrightclick(target);
                }
            } else {
                console.log("nothing clicked");
                if (ev.button == 0)
                    graph3d.onclick();
                if (ev.button > 0)
                    graph3d.onrightclick();
            }
        }
    }
    , false);
    //dummy plane to determine 3d location of the click, when we need to create vertices
    var dummyMat = new THREE.SpriteMaterial({
        map: glowMap,
        color: 0xeeeeff,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending
    });
    var dummyMat2 = new THREE.SpriteMaterial({
        map: glowMap,
        color: 0xeeeeff,
        transparent: true,
        opacity: 0.001,
        blending: THREE.AdditiveBlending
    });
    var clickPlane = new THREE.Sprite(dummyMat);
    clickPlane.scale.set(500, 500, 1.0);
    scene.add(clickPlane);
    graph3d.clickPlane = clickPlane;
    var clickPlaneMoveable = new THREE.Sprite(dummyMat2);
    clickPlaneMoveable.scale.set(500, 500, 1.0);
    scene.add(clickPlaneMoveable);
    graph3d.clickPlaneMoveable = clickPlaneMoveable;
    //this is for detecting 3d locations of clicks relative to a selected node


    //double click to edit graph - admittedly hacky; double click on empty space to create vertex, on a selected node to delete it, on a node adjacent to the selected node to delete an edge, or on another non-adjacent one to create an edge.
    domElement.addEventListener("dblclick", ev=>{
        if ((graph3d.world) && (graph3d.ondblclick)) {
            raycaster.setFromCamera(mousePos, graph3d.camera);
           const target=graph3d.getObjectAtPos(mouseDownPos);
            if (target) {
                graph3d.ondblclick(target);
            } else {
                console.log("nothing doubleclicked");
                graph3d.ondblclick(null);
            }
        }
    }
    , false);

    graph3d.getMousePosition3d = function() {
        raycaster.setFromCamera(mousePos, graph3d.camera);
        const intersects = raycaster.intersectObjects([graph3d.clickPlane]);
        //a large sprite through the origin, facing the camera
        if (intersects.length) {
            return intersects[0].point;
        }
    }

    graph3d.getAlignedMousePosition3d = function(obj) {
        graph3d.clickPlaneMoveable.position.copy(obj);
        raycaster.setFromCamera(mousePos, graph3d.camera);
        const intersects = raycaster.intersectObjects([graph3d.clickPlaneMoveable]);
        //a large sprite at the object's location
        if (intersects.length) {
            return intersects[0].point;
        }
    }

    // Setup renderer
    graph3d.renderer = new THREE.WebGLRenderer();
	//antialias:true;
	
    domElement.appendChild(graph3d.renderer.domElement);

    // Setup scene
    scene.background = new THREE.Color(0x000011);

	
    //This will add a starfield to the background of a scene
    var starsGeometry = new THREE.BufferGeometry();
	starsGeometry.addAttribute("position",)
	var starCount=10000;
	var positions = new THREE.BufferAttribute( new Float32Array( starCount * 3 ), 3);
	var colors = new THREE.BufferAttribute(  new Float32Array( starCount * 3 ), 3);
	var sizes = new THREE.BufferAttribute( new Float32Array( starCount), 1);
	starsGeometry.addAttribute('position', positions);
	starsGeometry.addAttribute('customColor', colors);
	starsGeometry.addAttribute('size', sizes);
	
	var star = new THREE.Vector3();var color=new THREE.Color();
    for (var i = 0; i < 10000; i++) {
        
        star.x = THREE.Math.randFloatSpread(6000);
        star.y = THREE.Math.randFloatSpread(6000);
        star.z = THREE.Math.randFloatSpread(6000);
		var saturation=Math.random()*0.3;
		color.setHSL(Math.random()*360,saturation,1 - (saturation / 2));
		if(star.length()>Math.random()*1000+2000){i--;continue;}
        positions.array[i*3]=star.x;
        positions.array[i*3+1]=star.y;
        positions.array[i*3+2]=star.z;
		colors.array[i*3]=color.r;
        colors.array[i*3+1]=color.g;
        colors.array[i*3+2]=color.b;
		sizes.array[i]=Math.random()*0.5+0.5;
    }
    /*var starsMaterial = new THREE.PointsMaterial({
        map: particleMap,
        color: 0xaaaaff,
        transparent: true,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });*/
	graph3d.starUniforms = {
		texture:   { type: "t", value: particleMap },
		time:       { value: 1.0 },
		resolution: { value: new THREE.Vector2() }
	};
	starsMaterial = new THREE.ShaderMaterial( {
		uniforms: graph3d.starUniforms,
		//attributes are in the geometry
		vertexShader: document.getElementById( 'nodesVertexShader' ).textContent,//??
		fragmentShader: document.getElementById( 'nodesFragmentShader' ).textContent,
		transparent: true,
		blending:THREE.AdditiveBlending,depthTest:false,
	} );
    scene.add(graph3d.starField = new THREE.Points(starsGeometry,starsMaterial));

	var selectGeometry = new THREE.Geometry();
    var selectMap = new THREE.ImageUtils.loadTexture('images/ring.png');
    var selectMat = new THREE.PointsMaterial({
        map: selectMap
    });
	//going to support multi-selection
    scene.add(graph3d.selectMarks = new THREE.Points(selectGeometry,selectMat));

    scene.fog = new THREE.FogExp2(0xaaaaaa,0.005);
    //scene.add(graph3d.nodes = new THREE.Group());scene.add(graph3d.links = new THREE.Group());
    scene.add(new THREE.AmbientLight(0xbbbbbb));
    scene.add(new THREE.DirectionalLight(0xffffff,0.6));
    graph3d.camera = new THREE.PerspectiveCamera();
    graph3d.camera.far = 20000;
    graph3d.controls = new MyControls(graph3d.camera,graph3d.renderer.domElement);

	
	
	// properties that may vary from particle to particle. only accessible in vertex shaders!
	//	(can pass color info to fragment shader via vColor.)

	graph3d.nodeUniforms = {
		texture:   { type: "t", value: particleMap },
		time:       { value: 1.0 },
		resolution: { value: new THREE.Vector2() }
	};
	graph3d.nodesMaterial = new THREE.ShaderMaterial( {
		uniforms: graph3d.nodeUniforms,
		//attributes are in the geometry
		vertexShader: document.getElementById( 'nodesVertexShader' ).textContent,
		fragmentShader: document.getElementById( 'nodesFragmentShader' ).textContent,
		transparent: true//, alphaTest: 0.5
		,
		blending:THREE.AdditiveBlending,depthTest:      false,
	} );
	graph3d.linkUniforms = {
		//texture:   { type: "t", value: testMap },
		time:       { value: 1.0 },
		resolution: { value: new THREE.Vector2() }
	};
	graph3d.linksMaterial = new THREE.ShaderMaterial( {
		uniforms: graph3d.linkUniforms,
		vertexShader: document.getElementById( 'linksVertexShader' ).textContent,
		fragmentShader: document.getElementById( 'linksFragmentShader' ).textContent,
		transparent: true,
		depthTest:false,side: THREE.DoubleSide,blending:THREE.AdditiveBlending,
	} );
	graph3d.playerUniforms = {
		//texture:   { type: "t", value: glowMap },
		time:       { value: 1.0 },
		//resolution: { value: new THREE.Vector2() }
	};
	graph3d.playersMaterial = new THREE.ShaderMaterial( {//players are displayed with Points, like nodes
		uniforms: graph3d.playerUniforms,
		vertexShader: document.getElementById( 'playersVertexShader' ).textContent,
		fragmentShader: document.getElementById( 'playersFragmentShader' ).textContent,
		transparent: true,
		depthTest:false,blending:THREE.AdditiveBlending,//side: THREE.DoubleSide,
	} );
	
	graph3d.nodesGeometry=new THREE.BufferGeometry();
	graph3d.nodes= new THREE.Points(graph3d.nodesGeometry,graph3d.nodesMaterial);
	scene.add(graph3d.nodes);
	graph3d.linksGeometry=new THREE.BufferGeometry();
	graph3d.links= new THREE.Mesh(graph3d.linksGeometry,graph3d.linksMaterial);
	graph3d.scene.add(graph3d.links);
	graph3d.playersGeometry=new THREE.BufferGeometry();
	graph3d.players= new THREE.Points(graph3d.playersGeometry,graph3d.playersMaterial);
	graph3d.scene.add(graph3d.players);
	
	
	
	
	
	
	
    graph3d.d3ForceLayout = d3.forceSimulation()//this is the 3d version
    .force('link', d3.forceLink().strength(graph3d.linkStrength).distance(graph3d.linkDistance)).force('charge', d3.forceManyBody().strength(graph3d.chargeStrength))//.theta(2.5); .force('center', d3.forceCenter())
    .force('collide', d3.forceCollide().radius(3)).force('radial', d3.forceRadial().radius(graph3d.radialRadius).strength(graph3d.radialStrength)).stop();

    var composer = new THREE.EffectComposer(graph3d.renderer);graph3d.composer=composer;
    var renderPass = new THREE.RenderPass(scene,graph3d.camera);
    //renderPass.renderToScreen = true;
    composer.addPass(renderPass);
	dpr = 1;
	if (window.devicePixelRatio !== undefined) {dpr = window.devicePixelRatio;}
	
	var effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);graph3d.effectFXAA=effectFXAA;
	effectFXAA.uniforms['resolution'].value.set(1 / (domElement.clientWidth * dpr), 1 / (domElement.clientHeight * dpr));
	effectFXAA.renderToScreen = true;
	composer.addPass(effectFXAA);
	
	var stats = new Stats();
	stats.showPanel( 0 );
	stats.dom.style.top="";
	stats.dom.style.bottom="0px";
	document.body.appendChild( stats.dom );
    (function animate() {
        // IIFE
		stats.begin();

        // Update tooltip
        var objAtMouse=graph3d.getObjectAtPos(graph3d.mousePos);
        toolTipElem.textContent = objAtMouse ? objAtMouse.label : '';

        //graph3d.d3ForceLayout.alpha(1);//want it to always run
        layoutTick();
        // Frame cycle
        graph3d.controls.update();
        var delta = clock.getDelta();
        composer.render(delta);
		

		stats.end();
        requestAnimationFrame(animate);
    }
    )();
    resizeCanvas();

    graph3d.newNodePositions = [];
    //a list of to-be-created node coordinates that the user clicked to create locally but the server has yet to respond, but we don't want to submit private coordinate info, so when the server responds, we create the node with the hint about where it should be
    graph3d.linkDistanceFactor = 1;
    graph3d.linkStrengthFactor = 0.1;
    graph3d.chargeStrengthFactor = 1;
    graph3d.radialStrengthFactor = 1;
    graph3d.chosenColor = {
        h: 0,
        s: 1,
        v: 1
    };
    graph3d.nodeText = "";
    var gui = new dat.GUI();
    graph3d.gui = gui;
    var forceFolder = gui.addFolder('Forces');
    forceFolder.add(graph3d, 'linkStrengthFactor', 0.01, 1).onChange(function(value) {
        graph3d.update();
    });
    forceFolder.add(graph3d, 'linkDistanceFactor', 0.5, 3).onChange(function(value) {
        graph3d.update();
    });
    forceFolder.add(graph3d, 'chargeStrengthFactor', 0.1, 5).onChange(function(value) {
        graph3d.update();
    });
    forceFolder.add(graph3d, 'radialStrengthFactor', 0.1, 5).onChange(function(value) {
        graph3d.update();
    });
    ;var colorFolder = gui.addFolder('Coloring(right click nodes)');
    colorFolder.addColor(graph3d, 'chosenColor');

    var textFolder = gui.addFolder('Text (select node & edit)');
    textFolder.add(graph3d, 'nodeText').onFinishChange(function(value) {
        console.log(value);
        graph3d.ontextchange(value);
    });

    var nodeFolder = gui.addFolder('Nodes (double click to add/remove)');
    nodeFolder.add(graph3d.nodes, 'visible');
    var linkFolder = gui.addFolder('Links (click endpoint to add/remove)');
    linkFolder.add(graph3d.links, 'visible');
}

//gestures

graph3d.onclick=function(target){
	//can't dismiss the context menu here because using it requires some clicks
	if(target)
	{
		//now, click = look at, right click = context menu/affordances, double click = default ability that applies to the object
		//todo: click+press number or letter keys = use key ability; click+press shift=selection
		function getHotKey(){
			
		}
		
		
		switch(target.type){
			case "vertex": 
				var color=new THREE.Color().setRGB(target.color.r,target.color.g,target.color.b);
				color.getHexString();
				graph3d.addLog("You see the "+(target.color.v>0.5?"large ":"small ")+ntc.name(color.getHexString())[1].toLowerCase()+" vertex "+target.id+"."); 
				break;
			case "edge": graph3d.addLog("You see the edge #"+target.id+" between vertices "+target.source.id+" and "+target.target.id+".");break;
			case "player": graph3d.addLog("You see a player.");break;
		}
	}
	else
	{
		//
	}
}
graph3d.onrightclick=function (target){
	if(target)
	{
		//todo
		if(graph3d.activeContextMenu){graph3d.contextElem.removeChild(graph3d.activeContextMenu);graph3d.activeContextMenu=null;}
		var menu=graph3d.contextMenus[target.type];
		if(!menu) return;
		var gui=new dat.GUI({ autoPlace: false });
		graph3d.activeContextMenu=gui.domElement;
		gui.domElement.style.position="";
		
		
		function createListener(key){
			return function(value) {
				socket.emit("use menu",{object:target,key:key,value:value});//make sure the color format matches that in the server
				if(graph3d.activeContextMenu){graph3d.contextElem.removeChild(graph3d.activeContextMenu);graph3d.activeContextMenu=null;}
				};
		}
		for(var prop in menu)
		{
			if(! (prop in target)){
				switch(menu[prop].type){
					case "color":target[prop]={h:0,s:0,v:0};break;
					case "string": target[prop]="";break;
					case "number": target[prop]=1;break;//todo: this is weird, we don't want zero in force simulations. but should define some default values
				}
			}
			if(menu[prop].type=="color"){gui.addColor(target,prop).onFinishChange(createListener(prop));}
			else{gui.add(target,prop).onFinishChange(createListener(prop));}
		}
		graph3d.contextElem.appendChild(gui.domElement);
		graph3d.contextElem.style.left=(graph3d.mouseScreenPos.x+20)+"px";
		graph3d.contextElem.style.bottom=(graph3d.mouseScreenPos.y+20)+"px";
	}
	else
	{//todo: a global context menu? for forces?
		if(graph3d.activeContextMenu){graph3d.contextElem.removeChild(graph3d.activeContextMenu);}
		graph3d.activeContextMenu=null;
	}
}
graph3d.ondblclick=	function(target){
	for(var i in graph3d.abilities)
	{
		if(graph3d.abilities[i].filter(target)){
			socket.emit("use ability",{ability:i,target:target});
			console.log("used ability "+graph3d.abilities[i].name+" with "+target);
			break;
		}
	}
	graph3d.addLog("can't use any ability on that");
}

graph3d.linkDistance = function(link) {
    return 30 * graph3d.linkDistanceFactor*(("length" in link)?(link.length+0.1):1);
}
graph3d.linkStrength = function(link) {
    var s = (Object.keys(link.source.edges).length);
    var t = (Object.keys(link.target.edges).length);
    return 1 * graph3d.linkStrengthFactor / Math.min(s, t);
}
graph3d.chargeStrength = function(data) {
    return -graph3d.chargeStrengthFactor*5 / (Object.keys(data.edges).length + 1);
}
graph3d.radialRadius = function(data) {
    if (!graph3d.cumulativeDist)
        return graph3d.order ? graph3d.order + 1 : 2;
    var d = Object.keys(data.edges).length;
    return Math.sqrt(graph3d.order ? graph3d.order + 1 : 2) * 10 * ((Math.cbrt(1.000001 - graph3d.cumulativeDist[d] / graph3d.order)+((d == 0) ? 1 : Math.cbrt(1.000001 - graph3d.cumulativeDist[d-1] / graph3d.order)))/2);//this means essentially the midpoint of the outer and inner radius of the degree layer, if layers are arranged so that their volume reflects the distribution
}
graph3d.radialStrength = function(data) {
    var x = (Object.keys(data.edges).length + 1);
    return graph3d.radialStrengthFactor * 0.001;
    //*x
}

graph3d.sizeChanged = function() {
    if (graph3d.world) {
        graph3d.order = Object.keys(graph3d.world.vertices).length;
    } else {
        graph3d.order = 0;
    }
    var size = Math.sqrt(graph3d.order + 1);//cube root or square root?
    graph3d.clickPlane.scale.x = size * 100;
    graph3d.clickPlane.scale.y = size * 100;
}
graph3d.degreeDistributionChanged = function() {
    var counts = {};
    var cumulative = {};
    var vs = graph3d.world.vertices;
    var maxDeg = -1;
    for (var i in vs) {
        var d = Object.keys(vs[i].edges).length;
        if (!(d in counts))
            counts[d] = 0;
        counts[d] += 1;
        if (maxDeg < d)
            maxDeg = d;
    }
    for (var i = 0; i <= maxDeg; i++) {
        var last = cumulative[i - 1] ? cumulative[i - 1] : 0;
        cumulative[i] = counts[i] ? counts[i] + last : last;
    }
    graph3d.degreeDist = counts;
    graph3d.cumulativeDist = cumulative;
    graph3d.maxDegree = maxDeg;
}
graph3d.update = function() {
    //for when the graph changes
    if (!graph3d.world){console.log("can't display missing world");return;}
	console.log("starting update");
	//need arrays
	graph3d.world.vArray=Object.values(graph3d.world.vertices);
	graph3d.world.eArray=Object.values(graph3d.world.edges);
	graph3d.world.pArray=Object.values(graph3d.world.players);
    graph3d.sizeChanged();
    graph3d.degreeDistributionChanged();
    graph3d.d3ForceLayout.stop().alpha(1)// re-heat the simulation
    .nodes(graph3d.world.vArray).force('link').id(d=>d["id"]).links(graph3d.world.eArray);    //recalculate forces

	graph3d.nodesGeometry=new THREE.BufferGeometry();
	var length=graph3d.world.vArray.length;
	var positions = new THREE.BufferAttribute( new Float32Array( length * 3 ), 3);positions.setDynamic(true);
	var colors = new THREE.BufferAttribute(  new Float32Array( length * 3 ), 3);colors.setDynamic(true);
	var sizes = new THREE.BufferAttribute( new Float32Array( length), 1);sizes.setDynamic(true);
	graph3d.nodesGeometry.addAttribute('position', positions);
	graph3d.nodesGeometry.addAttribute('customColor', colors);
	graph3d.nodesGeometry.addAttribute('size', sizes);
	graph3d.nodes.geometry=graph3d.nodesGeometry;
	
	graph3d.linksGeometry=new THREE.BufferGeometry();
	var length=graph3d.world.eArray.length;
	var positions2 = new THREE.BufferAttribute( new Float32Array( length * 18 ), 3);positions2.setDynamic(true);
	var coords = new THREE.BufferAttribute( new Float32Array( length * 18 ), 3);coords.setDynamic(true);//planar coordinate system for the link rectangles
	var colors2 = new THREE.BufferAttribute(  new Float32Array( length * 18 ), 3);colors2.setDynamic(true);
	var brightnesses = new THREE.BufferAttribute(  new Float32Array( length * 6 ), 1);brightnesses.setDynamic(true);
	graph3d.linksGeometry.addAttribute('position', positions2);
	graph3d.linksGeometry.addAttribute('coord', coords);
	graph3d.linksGeometry.addAttribute('customColor', colors2);
	graph3d.linksGeometry.addAttribute('brightness', brightnesses);
	graph3d.links.geometry=graph3d.linksGeometry;
	console.log("updated");
	
}
graph3d.updatePlayers=function()
{//recreate the player points buffer
	graph3d.playersGeometry=new THREE.BufferGeometry();
	var length=Object.keys(graph3d.world.players).length;//unlike nodes and links, this doesn't need to be an array
	var positions = new THREE.BufferAttribute( new Float32Array( length * 3 ), 3);positions.setDynamic(true);
	var colors = new THREE.BufferAttribute(  new Float32Array( length * 3 ), 3);colors.setDynamic(true);
	var sizes = new THREE.BufferAttribute( new Float32Array( length), 1);sizes.setDynamic(true);
	graph3d.playersGeometry.addAttribute('position', positions);
	graph3d.playersGeometry.addAttribute('customColor', colors);
	graph3d.playersGeometry.addAttribute('size', sizes);
	graph3d.players.geometry=graph3d.playersGeometry;
}
graph3d.selectObject = function(target,multi) {//need to support selecting any kind of game object - nodes, links, players etc
//currently selecting a player isn't supported, as it can be confused with selecting a vertex. A workaround for showing edge selection may be drawing marks in the center of the edge?

	const getSize={ //given an object's type, get the function that computes the select mark size
		vertex:(v)=>(v.color.v*4+2),
		edge:(e)=>3,
		player:(p)=>0
	};
	const getPosition={
		vertex:(v)=>v,
		edge:(e)=>((new THREE.Vector3).add(e.source).add(e.target).multiplyScalar(0.5)),//d3-force changed the vertex ids into references
		player:(p)=>graph3d.world.vertices[p.position]
	};
    if (target) {
		console.log("selection not implemented");
		if(!multi){
			//now I'm going to use real dragging and get rid of the click-to-drag hack

			//the selected objects can be of any type now
			
		}
        else{
			//todo
		}
		
    } else {
        graph3d.deselectObject();
    }

}
graph3d.deselectObject = function() {
    //todo
}


//topological ones
graph3d.addNode = function(node) {
    //creates the d3 node and the object
    if (!graph3d.world)
        return;
    if ((typeof node == "undefined") || (typeof node.id == "undefined")) {
        console.error("adding undefined node");
        return;
    }
    if (graph3d.world.vertices[node.id]) {
        console.error("adding node with existing ID " + node.id);
        return;
    }
    console.log("adding node " + node.id);
    
    world.vertices[node.id] = node;
    if (graph3d.newNodePositions.length > 0) {
        var c = graph3d.newNodePositions.pop();
        node.x = c.x;
        node.y = c.y;
        node.z = c.z;
    } else {
        node.x = Math.random();
        node.y = Math.random();
        node.z = Math.random();
    }
    
    graph3d.update();//will update the arrays
}
graph3d.deleteNode = function(id) {
    //deletes the d3 node and the object
    if (!graph3d.world)
        return;
    if (typeof id == "undefined")
        return;
    if (!graph3d.world.vertices[id]) {
        console.error("removing nonexistent node " + id);
        return;
    }
    var node = graph3d.world.vertices[id];
	console.log("removing node " + node.id);
    var l = node.edges;
    for (var target in l) {
        console.log("forced deletion of an edge to " + target);
		var eid=graph3d.world.vertices[id].edges[target];
        delete graph3d.world.vertices[id].edges[target];
        delete graph3d.world.vertices[target].edges[id];
        var link = graph3d.world.edges[eid];
            delete graph3d.world.edges[eid];
        if (!link) {
            console.log("can't find link object");
        }
    }
    delete graph3d.world.vertices[id];

    graph3d.update();//todo: pool updates and change visuals at most once per frame in case the server is very active
}

graph3d.addLink = function(data) {
    //node ids
    if (!graph3d.world)
        return;
    if ((typeof data.source == "undefined") || (typeof data.target == "undefined"))
        return;
    if (graph3d.world.vertices[data.source].edges[data.target]) {
        console.error("link already existing " + data.source + "," + data.target);
        return;
    }
    graph3d.world.vertices[data.source].edges[data.target] = data.id;
    graph3d.world.vertices[data.target].edges[data.source] = data.id;
    graph3d.world.edges[data.id]=data;
    graph3d.update();
}

graph3d.deleteLink = function(data) {
    //node ids
    if (!graph3d.world)
        return;
    if ((typeof data.source == "undefined") || (typeof data.target == "undefined"))
        return;
    if (!graph3d.world.vertices[data.source].edges[data.target]) {
        console.error("deleting nonexistent link " + data.source + "," + data.target);
        return;
    }
	var eid=graph3d.world.vertices[data.source].edges[data.target];
    delete graph3d.world.vertices[data.source].edges[data.target];
    delete graph3d.world.vertices[data.target].edges[data.source];
    var link= graph3d.world.edges[eid];
    delete graph3d.world.edges[eid];
    if (!link) {
        console.log("can't find link object");
    }
    //graph3d.deleteLink3d(link);
    graph3d.update();
}

graph3d.addObject=function(data){
	switch(data.type)
	{
		case "vertex": graph3d.addNode(data); break;
		case "edge": graph3d.addLink(data);break;
		case "player":graph3d.addPlayer(data);break;
	}
}
graph3d.deleteObject=function(data){
	switch(data.type)
	{
		case "vertex": graph3d.deleteNode(data); break;
		case "edge": graph3d.deleteLink(data);break;
		case "player":graph3d.deletePlayer(data);break;
	}
}
graph3d.updateObject=function(data){
	console.log("updating "+data.type+" " +data.id+": "+data.key+" to "+JSON.stringify(data.value));
	switch(data.type)
	{
		case "vertex": graph3d.world.vertices[data.id][data.key]=data.value; break;
		case "edge": graph3d.world.edges[data.id][data.key]=data.value; break;
		case "player":graph3d.world.players[data.id][data.key]=data.value; break;
	}
}
graph3d.addPlayer=function(data)
{
	graph3d.world.players[data.id]=data;
	graph3d.updatePlayers();
}
graph3d.deletePlayer=function(data)
{
	delete graph3d.world.players[data.id];
	graph3d.updatePlayers();
}

graph3d.show = function show(world) {
	console.log("showing world "+world.id);
	graph3d.world = world;
    layout = graph3d.d3ForceLayout;
	layout.stop().alpha(1)// re-heat the simulation
    .numDimensions(world.dimensions || 3);
	graph3d.update();
    graph3d.updatePlayers();
    graph3d.camera.position.x = 0;
    graph3d.camera.position.y = 0;
    graph3d.camera.position.z = Math.cbrt(graph3d.order + 1) * CAMERA_DISTANCE2NODES_FACTOR;
    graph3d.camera.lookAt(graph3d.nodes.position);
    //todo:tunnel effect of entering/exiting a world
    
	//prepare abilities and context menus
	//some utility functions for that
	var localPlayer=graph3d.world.players[graph3d.localPlayerID];
	
	function adjacent(a,b){return b in graph3d.world.vertices[a].edges;}
	function reachable(start, end)
	{
		if(typeof start=="object"){start=start.id;}
		if(typeof end=="object"){end=end.id;}
		var map={};
		explore(world,start);
		function explore(world,i,cc){
			map[i]=true;
			for(var n in world.vertices[i].edges){if(!(map[n]))explore(world,n);}
		}
		if(map[end])return true; 
		else return false;
	}
	
	graph3d.abilities=graph3d.worldTemplates[graph3d.world.template].abilities;
	for(var i=0;i<graph3d.abilities.length;i++){
		graph3d.abilities[i].filter=eval(graph3d.abilities[i].filter);
		if(typeof graph3d.abilities[i].filter !="function"){console.log("unable to parse filter for "+graph3d.abilities[i].name);}
	}
	
	graph3d.contextMenus=graph3d.worldTemplates[graph3d.world.template].menus||{};
	if(graph3d.activeContextMenu){graph3d.contextElem.removeChild(graph3d.activeContextMenu);}
	graph3d.activeContextMenu=null;
	//if I use dat.gui, the menu has to be created for every object when clicked
	
	
	
	console.log("shown world "+world.id);
}
var layout;
var cntTicks = 0;
var startTickTime = new Date();
function resizeCanvas() {
    var w = graph3d.domElement.clientWidth;
    var h = graph3d.domElement.clientHeight;
    graph3d.renderer.setSize(w, h);
    graph3d.camera.aspect = w / h;
    graph3d.camera.updateProjectionMatrix();
	graph3d.effectFXAA.uniforms['resolution'].value.set(1 / (window.innerWidth * dpr), 1 / (window.innerHeight * dpr));
	graph3d.composer.setSize(window.innerWidth * dpr, window.innerHeight * dpr);
}
var tested=false;
function layoutTick() {
    var world = graph3d.world;
    if (!world)
        return;

	if(!tested){tested=true;console.log("starting ticks");}
    //move the selected node slowly to the target location if any
    if (graph3d.selectedNode && graph3d.targetPos) {
        graph3d.d3ForceLayout.alpha(1);
        //enable simulation
        var n = graph3d.selectedNode;
        var t = graph3d.targetPos;
		if(!graph3d.targetIntermediatePos){graph3d.targetIntermediatePos=new THREE.Vector3().copy(graph3d.selectedNode);}
		var t2=graph3d.targetIntermediatePos;
        var temp = new THREE.Vector3().copy(t);
        temp.x -= n.x;
        temp.y -= n.y;
        temp.z -= n.z;
        temp.normalize();
        t2.x += temp.x;
        t2.y += temp.y;
        t2.z += temp.z;
		n.x=t2.x;n.y=t2=y;n.z=t2.z;
        if ((Math.abs(t.x - n.x) < 1) && (Math.abs(t.y - n.y) < 1) && (Math.abs(t.z - n.z) < 1)) {
            graph3d.targetIntermediatePos = undefined;
            graph3d.targetPos = undefined;
        }
    }

    graph3d.d3ForceLayout.tick();
	
	

	graph3d.nodeUniforms.time.value+=0.001;//??
	graph3d.linkUniforms.time.value+=0.001;
	graph3d.playerUniforms.time.value+=0.001;
	
	
	var positions=graph3d.nodesGeometry.attributes.position.array;
	var colors=graph3d.nodesGeometry.attributes.customColor.array;
	var sizes=graph3d.nodesGeometry.attributes.size.array;
	var color=new THREE.Color();
	for(var i=0,i3=0;i<world.vArray.length;i++,i3+=3)
	{
		var node=world.vArray[i];
		positions[ i3 + 0 ] = node.x;
		positions[ i3 + 1 ] = node.y;
		positions[ i3 + 2 ] = node.z;
		color.setHSL(node.color.h / 360, node.color.s, 1 - (node.color.s / 2));
		colors[ i3 + 0 ] = color.r;
		colors[ i3 + 1 ] = color.g;
		colors[ i3 + 2 ] = color.b;
		sizes[ i ] =node.color.v * 4  + 1.4;
	}
	
	
	
	graph3d.nodesGeometry.attributes.position.needsUpdate = true;
	graph3d.nodesGeometry.attributes.customColor.needsUpdate = true;
	graph3d.nodesGeometry.attributes.size.needsUpdate = true;
    graph3d.nodesGeometry.computeBoundingSphere();
	
	var positions2=graph3d.linksGeometry.attributes.position.array;
	var colors2=graph3d.linksGeometry.attributes.customColor.array;
	var coords=graph3d.linksGeometry.attributes.coord.array;
	var brightnesses=graph3d.linksGeometry.attributes.brightness.array;
	
	
	var p1=new THREE.Vector3();
	var p2=new THREE.Vector3();
	var v1=new THREE.Vector3();//source to target
	var v2=new THREE.Vector3();//camera to source
	var v3=new THREE.Vector3();//camera to target
	var up=new THREE.Vector3();
	var n1=new THREE.Vector3();
	for(var i=0,i6=0,i18=0;i<world.eArray.length;i++,i6+=6,i18+=18)
	{
		var link=world.eArray[i];
		//calculate the sideways vector for the link ribbon
		p1.copy(link.source);p2.copy(link.target);
		v1.copy(p1);v1.multiplyScalar(-1);v1.add(p2);
		v2.copy(p1);v2.multiplyScalar(-1);v2.add(graph3d.camera.position);
		v3.copy(p2);v3.multiplyScalar(-1);v3.add(graph3d.camera.position);
		up.copy(graph3d.camera.position);up.multiplyScalar(-1);up.add(p2);
		up.cross(v1);up.normalize();
		up.multiplyScalar(link.thickness?link.thickness*2+1:1);//show thickness easily without having to add an attribute...
		//up.copy(v2);up.cross(v1);up.normalize();
		
		positions2[ i18 + 0 ] = link.source.x+up.x;
		positions2[ i18 + 1 ] = link.source.y+up.y;
		positions2[ i18 + 2 ] = link.source.z+up.z;
		positions2[ i18 + 3 ] = link.source.x-up.x;
		positions2[ i18 + 4 ] = link.source.y-up.y;
		positions2[ i18 + 5 ] = link.source.z-up.z;
		positions2[ i18 + 6 ] = link.target.x+up.x;
		positions2[ i18 + 7 ] = link.target.y+up.y;
		positions2[ i18 + 8 ] = link.target.z+up.z;
		
		positions2[ i18 + 9 ] = link.source.x-up.x;
		positions2[ i18 + 10 ] = link.source.y-up.y;
		positions2[ i18 + 11 ] = link.source.z-up.z;
		positions2[ i18 + 12 ] = link.target.x-up.x;
		positions2[ i18 + 13 ] = link.target.y-up.y;
		positions2[ i18 + 14 ] = link.target.z-up.z;
		positions2[ i18 + 15 ] = link.target.x+up.x;
		positions2[ i18 + 16 ] = link.target.y+up.y;
		positions2[ i18 + 17 ] = link.target.z+up.z;
		
		coords[ i18 + 0 ] = -1;  //(-1,1), (1,1) the first two dimensions specify the relative coords in the ribbon
		coords[ i18 + 1 ] = 1;	// (-1,-1), (1,-1)
		coords[ i18 + 2 ] = v2.length();//the third dimension is depth, used for adaptively making the link look thicker for antialiasing when the link is too far away
		coords[ i18 + 3 ] = -1; 
		coords[ i18 + 4 ] = -1;
		coords[ i18 + 5 ] = v2.length();
		coords[ i18 + 6 ] = 1; 
		coords[ i18 + 7 ] = 1;
		coords[ i18 + 8 ] = v3.length();
		
		coords[ i18 + 9 ] = -1;
		coords[ i18 + 10 ] = -1;
		coords[ i18 + 11 ] = v2.length();
		coords[ i18 + 12 ] = 1; 
		coords[ i18 + 13 ] = -1;
		coords[ i18 + 14 ] = v3.length();
		coords[ i18 + 15 ] = 1; 
		coords[ i18 + 16 ] = 1;
		coords[ i18 + 17 ] = v3.length();
		
		var brightness=("brightness" in link)?Math.min(link.brightness+0.1,1):1;
		brightnesses[ i6 + 0 ] = brightness;
		brightnesses[ i6 + 1 ] = brightness;	
		brightnesses[ i6 + 2 ] = brightness;
		brightnesses[ i6 + 3 ] = brightness; 
		brightnesses[ i6 + 4 ] = brightness;
		brightnesses[ i6 + 5 ] = brightness;
		
		colors2[ i18 + 0 ] = link.source.color.r*brightness;
		colors2[ i18 + 1 ] = link.source.color.g*brightness;
		colors2[ i18 + 2 ] = link.source.color.b*brightness;
		colors2[ i18 + 3 ] = link.source.color.r*brightness;
		colors2[ i18 + 4 ] = link.source.color.g*brightness;
		colors2[ i18 + 5 ] = link.source.color.b*brightness;
		colors2[ i18 + 6 ] = link.target.color.r*brightness;
		colors2[ i18 + 7 ] = link.target.color.g*brightness;
		colors2[ i18 + 8 ] = link.target.color.b*brightness;
		
		colors2[ i18 + 9 ] = link.source.color.r*brightness;
		colors2[ i18 + 10 ] = link.source.color.g*brightness;
		colors2[ i18 + 11 ] = link.source.color.b*brightness;
		colors2[ i18 + 12 ] = link.target.color.r*brightness;
		colors2[ i18 + 13 ] = link.target.color.g*brightness;
		colors2[ i18 + 14 ] = link.target.color.b*brightness;
		colors2[ i18 + 15 ] = link.target.color.r*brightness;
		colors2[ i18 + 16 ] = link.target.color.g*brightness;
		colors2[ i18 + 17 ] = link.target.color.b*brightness;

	}
	graph3d.linksGeometry.attributes.position.needsUpdate = true;
	graph3d.linksGeometry.attributes.coord.needsUpdate = true;
	graph3d.linksGeometry.attributes.customColor.needsUpdate = true;
	graph3d.linksGeometry.attributes.brightness.needsUpdate = true;
    graph3d.linksGeometry.computeBoundingSphere();

	//players
	var positions=graph3d.playersGeometry.attributes.position.array;
	var colors=graph3d.playersGeometry.attributes.customColor.array;
	var sizes=graph3d.playersGeometry.attributes.size.array;
	var color=new THREE.Color();var i=0,i3=0;
	for(var j in graph3d.world.pArray)//though it doesn't use D3 forces, it needs to be clicked
	{
		var player=graph3d.world.pArray[j];var node=world.vertices[player.position];
		positions[ i3 + 0 ] = node.x;
		positions[ i3 + 1 ] = node.y;
		positions[ i3 + 2 ] = node.z;
		color.setHSL(node.color.h / 360, node.color.s, 1 - (node.color.s / 2));
		
		if(player.id==graph3d.localPlayerID){
			sizes[i]=node.color.v * 4  + 8;
			colors[ i3 + 0 ] = 0.3;
			colors[ i3 + 1 ] = 1;//green for self
			colors[ i3 + 2 ] = 0.3;
		}
		else{
			sizes[ i ] =node.color.v * 4  + 3.5;
			colors[ i3 + 0 ] = color.r;
			colors[ i3 + 1 ] = color.g;
			colors[ i3 + 2 ] = color.b;
		}//todo - the player should have a power value in itself
		
		i++;i3+=3;
	}
	
	graph3d.playersGeometry.attributes.position.needsUpdate = true;
	graph3d.playersGeometry.attributes.customColor.needsUpdate = true;
	graph3d.playersGeometry.attributes.size.needsUpdate = true;
    graph3d.playersGeometry.computeBoundingSphere();
	
	//logs
	
	var logs=graph3d.logElem.children;
	for(var i =0;i<logs.length;i++)
	{
		if((new Date().getTime()-logs[i].createTime)>2000){logs[i].style.display="none";}
	}
	var lastlog=graph3d.logElem.lastElementChild;
	if(lastlog&&(lastlog.style.display=="none")){graph3d.logElem.removeChild(lastlog);}
}
