//heavily modified from 3d-force-graph, from the author of d3-forcelayout-3d
//note: the intended effect is that nodes mostly form layers of a sphere (assuming the graph is mostly sparse and disconnected, which is probably true for multi-user hand-made graphs), where high degree nodes (and denser subgraphs) are nearer the center and low degree ones are at the outside. High degree nodes get more inward radial force which pulls them towards the smallest possible layer that can fit all nodes (so the radius is proportional to the square root of the graph order, and in the limit of infinite degree, stuff just fit into a layer as small as possible rather than being squeezed at the center). When heavy nodes have lighter nodes attached, they may rise as a whole (so average degree is what matters).
//a degree-layer's thickness should be correlated with the number or proportion of the nodes of that degree.

var CAMERA_DISTANCE2NODES_FACTOR = 150;
var clock = new THREE.Clock();
const scene = new THREE.Scene();
//has a nodes and a links object, plus other objects like star background
const graph3d = {};

//init the scene once, but scenes may be reset as player enters new worlds
function init3d(domElement) {
    var navInfo;
	graph3d.domElement=domElement;
    domElement.appendChild(navInfo = document.createElement('div'));
    navInfo.className = 'graph-nav-info';
    navInfo.textContent = "MOVE mouse & press LEFT/A: rotate, MIDDLE/S: zoom, RIGHT/D: pan";
    domElement.appendChild(graph3d.infoElem = document.createElement('div'));
    graph3d.infoElem.className = 'graph-info-msg';
    graph3d.infoElem.textContent = '';
    const toolTipElem = document.createElement('div');
    toolTipElem.classList.add('graph-tooltip');
    domElement.appendChild(toolTipElem);

    const raycaster = new THREE.Raycaster();
    const mousePos = new THREE.Vector2();
    mousePos.x = -2;
    // Initialize off canvas
    mousePos.y = -2;
    domElement.addEventListener("mousemove", ev=>{
        graph3d.d3ForceLayout.alpha(1);
        const offset = getOffset(domElement)
          , relPos = {
            x: ev.pageX - offset.left,
            y: ev.pageY - offset.top
        };
		mousePos.x = ( event.clientX / domElement.clientWidth ) * 2 - 1;
		mousePos.y = - ( event.clientY / domElement.clientHeight ) * 2 + 1;
        //mousePos.x = ((relPos.x / domElement.clientWidth) * 2 - 1);
        //mousePos.y = -(relPos.y / domElement.clientHeight) * 2 + 1;
        toolTipElem.style.top = (relPos.y - 40) + 'px';
        toolTipElem.style.left = (relPos.x - 20) + 'px';

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
    domElement.addEventListener("mousedown", ev=>{
        mouseDownPos.x = mousePos.x;
        mouseDownPos.y = mousePos.y;
    }
    );
    domElement.addEventListener("mouseup", ev=>{
        if ((graph3d.world) && (graph3d.onclick) && (mouseDownPos.y == mousePos.y) && (mouseDownPos.x == mousePos.x)) {
            raycaster.setFromCamera(mousePos, graph3d.camera);
            const intersects = raycaster.intersectObjects(graph3d.nodes.children).filter(o=>o.object.__data);
            // Check only objects with data (nodes)
            if (intersects.length) {
                //console.log("node " + intersects[0].object.__data.id + "clicked");
                if (ev.button == 0) {
                    graph3d.onclick(intersects[0].object.__data);
                }
                if (ev.button > 0) {
                    graph3d.onrightclick(intersects[0].object.__data);
                }
            } else {
                console.log("no node clicked");
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
        color: color,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending
    });
    var dummyMat2 = new THREE.SpriteMaterial({
        map: glowMap,
        color: color,
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
            const intersects = raycaster.intersectObjects(graph3d.nodes.children);
            if (intersects.length) {
                var target = intersects[0].object.__data;
                console.log("node " + target.id + "clicked");
                graph3d.ondblclick(target);
            } else {
                console.log("no node doubleclicked");
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
        graph3d.clickPlaneMoveable.position.copy(obj.position);
        raycaster.setFromCamera(mousePos, graph3d.camera);
        const intersects = raycaster.intersectObjects([graph3d.clickPlaneMoveable]);
        //a large sprite at the object's location
        if (intersects.length) {
            return intersects[0].point;
        }
    }

    // Setup renderer
    graph3d.renderer = new THREE.WebGLRenderer();
    //({ alpha: true });//graph3d.renderer.setClearColor( 0x000000, 0 );
    domElement.appendChild(graph3d.renderer.domElement);

    // Setup scene
    scene.background = new THREE.Color(0x000011);

    //This will add a starfield to the background of a scene
    var starsGeometry = new THREE.Geometry();
    for (var i = 0; i < 10000; i++) {
        var star = new THREE.Vector3();
        star.x = THREE.Math.randFloatSpread(2000);
        star.y = THREE.Math.randFloatSpread(2000);
        star.z = THREE.Math.randFloatSpread(2000);
        starsGeometry.vertices.push(star);
    }
    var starsMaterial = new THREE.PointsMaterial({
        map: new THREE.ImageUtils.loadTexture('images/particle.png'),
        color: 0xaaaaff,
        transparent: true,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });
    //new THREE.PointsMaterial( { color: 0x888888 } );
    scene.add(graph3d.starField = new THREE.Points(starsGeometry,starsMaterial));

    var selectMap = new THREE.ImageUtils.loadTexture('images/ring.png');
    var selectMat = new THREE.SpriteMaterial({
        map: selectMap,
        transparent: false,
        blending: THREE.AdditiveBlending
    });
    graph3d.selectMark = new THREE.Sprite(selectMat);
    //graph3d.selectMark.visible=false;
    //scene.add(selectMark);

    scene.fog = new THREE.FogExp2(0xaaaaaa,0.005);
    scene.add(graph3d.nodes = new THREE.Group());
    scene.add(graph3d.links = new THREE.Group());
    scene.add(new THREE.AmbientLight(0xbbbbbb));
    scene.add(new THREE.DirectionalLight(0xffffff,0.6));
    graph3d.camera = new THREE.PerspectiveCamera();
    graph3d.camera.far = 20000;
    const controls = new MyControls(graph3d.camera,graph3d.renderer.domElement);

    const newLineGeometry = new THREE.Geometry();
    var newLineStart = new THREE.Vector3;
    var newLineEnd = new THREE.Vector3;
    var newLineColor1 = new THREE.Color();
    var newLineColor2 = new THREE.Color();
    newLineGeometry.vertices.push(newLineStart, newLineEnd);
    newLineGeometry.colors.push(newLineColor1, newLineColor2);
    const newLine = new THREE.Line(newLineGeometry,new THREE.LineBasicMaterial({
        vertexColors: THREE.VertexColors
    }));
    newLine.renderOrder = 10;
    // Prevent visual glitches of dark lines on top of spheres by rendering them last
    newLine.visible = false;
    scene.add(newLine);

    graph3d.d3ForceLayout = d3.forceSimulation()//this is the 3d version
    .force('link', d3.forceLink().strength(graph3d.linkStrength).distance(graph3d.linkDistance)).force('charge', d3.forceManyBody().strength(graph3d.chargeStrength))//.force('center', d3.forceCenter())
    .force('collide', d3.forceCollide().radius(3)).force('radial', d3.forceRadial().radius(graph3d.radialRadius).strength(graph3d.radialStrength)).stop();

    var composer = new THREE.EffectComposer(graph3d.renderer);
    var renderPass = new THREE.RenderPass(scene,graph3d.camera);
    renderPass.renderToScreen = true;
    composer.addPass(renderPass);

    (function animate() {
        // IIFE
        // Update tooltip
        raycaster.setFromCamera(mousePos, graph3d.camera);
        const intersects = raycaster.intersectObjects(graph3d.nodes.children);
        toolTipElem.textContent = intersects.length ? intersects[0].object.__data.text : '';

        //graph3d.d3ForceLayout.alpha(1);//want it to always run
        layoutTick();
        // Frame cycle
        controls.update();
        var delta = clock.getDelta();
        composer.render(delta);
        requestAnimationFrame(animate);
    }
    )();
    resizeCanvas();

    graph3d.newNodePositions = [];
    //a list of to-be-created node coordinates that the user clicked to create locally but the server has yet to respond, but we don't want to submit private coordinate info, so when the server responds, we create the node with the hint about where it should be
    graph3d.linkDistanceFactor = 1;
    graph3d.linkStrengthFactor = 1;
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
    forceFolder.add(graph3d, 'linkStrengthFactor', 0.1, 2).onChange(function(value) {
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
var glowMap = new THREE.ImageUtils.loadTexture('images/glow.png');
glowMap.name = "glow";
var particleMap = new THREE.ImageUtils.loadTexture('images/particle.png');
particleMap.name = "particle";
const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    blending: THREE.AdditiveBlending
});
//vertexColors: true,
//since node color(displayed color) and size change a lot, do not reuse sprites and models now

graph3d.linkDistance = function(link) {
    return 30 * graph3d.linkDistanceFactor;
}
graph3d.linkStrength = function(link) {
    var s = (Object.keys(link.source.links).length);
    var t = (Object.keys(link.target.links).length);
    return 1 * graph3d.linkStrengthFactor / Math.min(s, t);
}
graph3d.chargeStrength = function(data) {
    return -graph3d.chargeStrengthFactor / (Object.keys(data.links).length + 1);
}
graph3d.radialRadius = function(data) {
    if (!graph3d.cumulativeDist)
        return graph3d.order ? graph3d.order + 1 : 2;
    var d = Object.keys(data.links).length;
    return Math.sqrt(graph3d.order ? graph3d.order + 1 : 2) * 20 * ((d == 0) ? 1 : Math.cbrt(1 - graph3d.cumulativeDist[d - 1] / graph3d.order));
}
graph3d.radialStrength = function(data) {
    var x = (Object.keys(data.links).length + 1);
    return graph3d.radialStrengthFactor * 0.001;
    //*x
}

graph3d.sizeChanged = function() {
    if (graph3d.world) {
        graph3d.order = graph3d.world.nodes.length;
    } else {
        graph3d.order = 0;
    }
    var size = Math.sqrt(graph3d.order + 1);
    //cube root or square root?
    graph3d.clickPlane.scale.x = size * 100;
    graph3d.clickPlane.scale.y = size * 100;
}
graph3d.degreeDistributionChanged = function() {
    var counts = {};
    var cumulative = {};
    var nodes = graph3d.world.nodes;
    var maxDeg = -1;
    for (var i = 0; i < nodes.length; i++) {
        var d = Object.keys(nodes[i].links).length;
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
    if (!graph3d.world)
        return;
    graph3d.sizeChanged();
    graph3d.degreeDistributionChanged();
    graph3d.d3ForceLayout.stop().alpha(1)// re-heat the simulation
    .nodes(graph3d.world.nodes).force('link').id(d=>d["id"]).links(graph3d.world.links);
    //recalculate forces
}

graph3d.selectNode = function(target) {
    if (target) {
        //clear the moving target position
        graph3d.targetNodeLocation = undefined;
        //change the ring color to match
        graph3d.selectMark.material.color.setHSL(target.color.hue, target.color.saturation, 1 - (target.color.saturation / 2));
        graph3d.selectedNode = target;
        var sphere = graph3d.selectedNode.__sphere;
        sphere.add(graph3d.selectMark);
        //set gui
		graph3d.chosenColor.h=graph3d.selectedNode.color.hue;
		graph3d.chosenColor.s=graph3d.selectedNode.color.saturation;
		graph3d.chosenColor.v=graph3d.selectedNode.color.value;
        graph3d.nodeText = graph3d.selectedNode.text ? graph3d.selectedNode.text : "";
        graph3d.gui.updateDisplay();
		
    } else {
        graph3d.deselectNode();
    }

}
graph3d.deselectNode = function() {
    var sphere = graph3d.selectedNode.__sphere;
    sphere.remove(graph3d.selectMark);
    graph3d.selectedNode = undefined;
}
//non-topological operations
graph3d.colorNode = function(id, color) {
    //color is hsv from the color picker
    if (!graph3d.world)
        return;
    var node = graph3d.world.nodesMap[id];
    if (!node.color)
        node.color = {r:0,g:0,b:0};
	if(node.color)
	{
		graph3d.world.color.r-=node.color.r;graph3d.world.color.g-=node.color.g;graph3d.world.color.b-=node.color.b;
	}
    node.color.hue = color.h;
    node.color.saturation = color.s;
    node.color.value = color.v;
    console.log(color);
    var newColor = hsv.rgb([color.h, color.s * 100, color.v * 100]);
    //the range from the color picker is different
    node.color.r = newColor[0];
    node.color.g = newColor[1];
    node.color.b = newColor[2];
	graph3d.world.color.r+=newColor[0];graph3d.world.color.g+=newColor[1];graph3d.world.color.b+=newColor[2];
}
graph3d.labelNode = function(id, text) {
    if (!graph3d.world)
        return;
    var node = graph3d.world.nodesMap[id];
    node.text = text;
    console.log("labeled " + id + ": " + text);
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
    if (graph3d.world.nodesMap[node.id]) {
        console.error("adding node with existing ID " + node.id);
        return;
    }
    //var node={id:id,index:world.nodes.length,links:{}};
    node.index = world.nodes.length;
    world.nodes.push(node);
    world.nodesMap[node.id] = node;
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
    graph3d.addNode3d(node);
    //this creates a sprite and adds it to the 3d scene
    graph3d.update();
}
graph3d.addNode3d = function(node) {
    //given a d3 node create a three.js object, ignore nodes with existing objects
    if (!graph3d.world)
        return;
    if (!node)
        return;
    if (node.__sphere) {
        return;
    }
    //??
    var color = node.color || 0xdddddd;
    var glowMaterial = new THREE.SpriteMaterial({
        map: glowMap,
        color: color,
        opacity: 0.5,
        transparent: false,
        blending: THREE.AdditiveBlending
    });
    var absorbMaterial = new THREE.SpriteMaterial({
        map: glowMap,
        color: color,
        opacity: 0.05,
        transparent: false,
        blending: THREE.SubtractiveBlending
    });
    var particleMaterial = new THREE.SpriteMaterial({
        map: particleMap,
        color: color,
        transparent: false,
        blending: THREE.AdditiveBlending
    });
    var size = node.val || 1;
    //var sphereGeometry= new THREE.SphereGeometry(Math.cbrt(size) * 5, 4, 4);
    var sphere = new THREE.Sprite(glowMaterial);
    sphere.scale.set(Math.cbrt(size) * 25, Math.cbrt(size) * 25, 1.0);
    //new THREE.Points(sphereGeometries[val], new THREE.PointsMaterial())//particleMaterials[color]);
    sphere.name = node.name;
    sphere.__data = node;
    var raySprite = new THREE.Sprite(particleMaterial);
    raySprite.scale.set(1, 1, 1.0);
    sphere.add(raySprite);
    var absorbSprite = new THREE.Sprite(absorbMaterial);
    absorbSprite.scale.set(1, 1, 1.0);
    sphere.add(absorbSprite);
    node.__sphere = sphere;
    node.__rays = raySprite;
    node.__cloud = absorbSprite;
    //node.__particles=particlesField;
    if (!("energy"in node)) {
        node.energy = 0;
    }
    graph3d.nodes.add(sphere);
}
graph3d.deleteNode = function(id) {
    //deletes the d3 node and the object
    if (!graph3d.world)
        return;
    if (typeof id == "undefined")
        return;
    if (!graph3d.world.nodesMap[id]) {
        console.error("removing nonexistent node " + id);
        return;
    }
    var node = graph3d.world.nodesMap[id];
    var l = node.links;
    for (var target in l) {
        console.log("forced deletion of an edge to " + target);
        delete graph3d.world.nodesMap[id].links[target];
        delete graph3d.world.nodesMap[target].links[id];
        var link;
        if (Number(id) < Number(target)) {
            link = graph3d.world.linksMap[id + "-" + target];
            delete graph3d.world.linksMap[id + "-" + target];
        } else {
            link = graph3d.world.linksMap[target + "-" + id];
            delete graph3d.world.linksMap[target + "-" + id];
        }
        if (!link) {
            console.log("can't find link object");
        }
        graph3d.deleteLink3d(link);
    }
    delete graph3d.world.nodesMap[id];
    graph3d.world.nodes = Object.values(graph3d.world.nodesMap);
    graph3d.world.links = Object.values(graph3d.world.linksMap);
    graph3d.deleteNode3d(node);
    //this removes the sprite
    graph3d.update();
}
graph3d.deleteNode3d = function(node) {
    //only removes the 3d object of the d3 node. the nodes array is maintained by the caller
    if (!node)
        return;
    if (!node.__sphere) {
        return;
    }
    //??
    graph3d.nodes.remove(node.__sphere);
}
graph3d.addLink = function(source, target) {
    //node ids
    if (!graph3d.world)
        return;
    if ((typeof source == "undefined") || (typeof target == "undefined"))
        return;
    if (graph3d.world.nodesMap[source].links[target]) {
        console.error("link already existing " + source + "," + target);
        return;
    }
    graph3d.world.nodesMap[source].links[target] = graph3d.world.nodesMap[target];
    graph3d.world.nodesMap[target].links[source] = graph3d.world.nodesMap[source];
    var link;
    if (Number(source) < Number(target)) {
        console.log("adding link " + source + "," + target);
        link = graph3d.world.linksMap[source + "-" + target] = {
            source: graph3d.world.nodesMap[source],
            target: graph3d.world.nodesMap[target]
        };
    } else {
        console.log("adding link " + target + "," + source);
        link = graph3d.world.linksMap[target + "-" + source] = {
            source: graph3d.world.nodesMap[target],
            target: graph3d.world.nodesMap[source]
        };
    }
    graph3d.world.links = Object.values(graph3d.world.linksMap);
    graph3d.addLink3d(link);
    graph3d.update();
}
graph3d.addLink3d = function(link) {
    //here we don't care about the indices of the nodes in d3, just the references
    if (!graph3d.world)
        return;
    if (!link)
        return;
    if (link.__line) {
        return;
    }
    //??
    var startNode = link.source
      , endNode = link.target;
    var color1 = startNode.__sphere.material.color
      , color2 = endNode.__sphere.material.color;
    var geometry = new THREE.Geometry();
    geometry.vertices.push(startNode.__sphere.position, endNode.__sphere.position);
    geometry.colors.push(color1, color2);
    var line = new THREE.Line(geometry,lineMaterial);
    line.renderOrder = 10;
    // Prevent visual glitches of dark lines on top of spheres by rendering them last - doesn't work with sprites?
    graph3d.links.add(link.__line = line);
}
graph3d.deleteLink = function(source, target) {
    //node ids
    if (!graph3d.world)
        return;
    if ((typeof source == "undefined") || (typeof target == "undefined"))
        return;
    if (!graph3d.world.nodesMap[source].links[target]) {
        console.error("deleting nonexistent link " + source + "," + target);
        return;
    }
    delete graph3d.world.nodesMap[source].links[target];
    delete graph3d.world.nodesMap[target].links[source];
    var link;
    if (Number(source) < Number(target)) {
        link = graph3d.world.linksMap[source + "-" + target];
        delete graph3d.world.linksMap[source + "-" + target];
    } else {
        link = graph3d.world.linksMap[target + "-" + source];
        delete graph3d.world.linksMap[target + "-" + source];
    }
    graph3d.world.links = Object.values(graph3d.world.linksMap);
    if (!link) {
        console.log("can't find link object");
    }
    graph3d.deleteLink3d(link);
    graph3d.update();
}
graph3d.deleteLink3d = function(link) {
    //here we don't care about the indices of the nodes in d3, just the references
    if (!link)
        return;
    if (!link.__line) {
        return;
    }
    //??
    graph3d.links.remove(link.__line);
}
graph3d.show = function show(world) {
    layout = graph3d.d3ForceLayout;
    //init the layout first to turn id-based links into reference-based links
    layout.stop().alpha(1)// re-heat the simulation
    .numDimensions(world.dimensions || 3).nodes(world.nodes).force('link').id(d=>d["id"]).links(world.links);
    graph3d.world = world;
    while (graph3d.nodes.length) {
        graph3d.nodes.remove(graph3d.nodes.children[0]);
    }
    while (graph3d.links.length) {
        graph3d.links.remove(graph3d.links.children[0])
    }
    world.nodes.forEach(function(node) {
        graph3d.addNode3d(node);
    });
    world.links.forEach(function(link) {
        graph3d.addLink3d(link);
    });
    //can't use update() above because of the above issue
    graph3d.update();
    graph3d.camera.position.x = 0;
    graph3d.camera.position.y = 0;
    graph3d.camera.position.z = Math.cbrt(graph3d.order + 1) * CAMERA_DISTANCE2NODES_FACTOR;
    graph3d.camera.lookAt(graph3d.nodes.position);
    //todo:tunnel effect of entering/exiting a world
    graph3d.infoElem.textContent = '';
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
}

function layoutTick() {
    var world = graph3d.world;
    if (!world)
        return;

    //move the selected node slowly to the target location if any
    if (graph3d.selectedNode && graph3d.targetNodeLocation) {
        graph3d.d3ForceLayout.alpha(1);
        //enable simulation
        var n = graph3d.selectedNode;
        var t = graph3d.targetNodeLocation;
        var temp = new THREE.Vector3().copy(t);
        temp.x -= n.x;
        temp.y -= n.y;
        temp.z -= n.z;
        temp.normalize();
        n.x += temp.x;
        n.y += temp.y;
        n.z += temp.z;
        if ((Math.abs(t.x - n.x) < 1) && (Math.abs(t.y - n.y) < 1) && (Math.abs(t.z - n.z) < 1)) {
            graph3d.targetNodeLocation = undefined;
        }
    }

    graph3d.d3ForceLayout.tick();

    world.nodes.forEach(node=>{
        const sphere = node.__sphere;
        if (!sphere)
            return;
        const pos = node;
        sphere.position.x = pos.x;
        sphere.position.y = pos.y || 0;
        sphere.position.z = pos.z || 0;
        const color = sphere.material.color;
        const color2 = node.__rays.material.color;
        //if(!node.color){node.color={r:0,g:0,b:0}}
        if (node.color) {
            color2.setHSL(node.color.hue / 360, node.color.saturation, 1 - (node.color.saturation / 2));
            //the inner rays must have a consistent visual brightness across all nodes
            var size = node.color.value * 0.7 + 0.3;
            //express brightness through star size, not color - we don't actually want black stars
            node.__cloud.scale.x = size;
            node.__cloud.scale.y = size;
            node.__rays.scale.x = size;
            node.__rays.scale.y = size;
            color.setRGB(node.color.r / 255, node.color.g / 255, node.color.b / 255);
            //outer glow can have different brightness - black is invisible under additive blending
        }
        if (node.energy > 0.1) {
            if (Math.random() > 0.5)
                node.energy -= 0.02;
        }
        //energy is a client-side-only variable, used for star twinkling effect
        if (node.energy < 0.9) {
            if (Math.random() > 0.5)
                node.energy += 0.02;
        }
        var colorFactor = node.energy > 1 ? 0.6 : node.energy * 0.5 + 0.1;
        color.r *= colorFactor;
        color.g *= colorFactor;
        color.b *= colorFactor;
    }
    );

    // Update links position
    world.links.forEach(link=>{
        const line = link.__line;
        if (!line)
            return;
        const start = link.source
          , //here the start and end are d3 node objects
        end = link.target
          , linePos = line.geometry.vertices;
        linePos[0].x = start.x;
        linePos[0].y = start.y || 0;
        linePos[0].z = start.z || 0;
        linePos[1].x = end.x;
        linePos[1].y = end.y || 0
        linePos[1].z = end.z || 0;

        line.geometry.verticesNeedUpdate = true;
        line.geometry.colorsNeedUpdate = true;
        //line.geometry.computeBoundingSphere();
    }
    );
}
