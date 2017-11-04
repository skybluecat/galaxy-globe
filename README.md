# Galaxy Globe Graph Sandbox
multi-player sandbox game based on 3D graph drawing

## running
Example local install: Install socket.io and express in npm, run "node app.js" in the main directory, navigate browser to localhost:3000

## playing
You will choose between different worlds/game modes at the start. Some are multiplayer sandboxes with varying levels of competition. Some are single-player games. Click the Exit world button to go back and choose another world.

### general information
There are several kinds of game objects: vertices(or nodes), edges(or links), and players.

Players have positions, and are shown as animated glowing rings around the vertices they are on. **The larger green ring represents you.**

Hover your mouse over an object to see its label if any.

Left click on an object to see its description. Left click and drag to rotate the view. 

Right click to open the context menu of the object, if available, where you can set its color or label. Right click and drag to pan.

Use the mouse wheel to zoom.

Double click on an object to use an applicable ability.

Note: you can play with mobile devices, but touch inputs may not work very well.

### abilities
Different worlds allow different abilities. Abilities may require a target (a vertex or an edge), and the first applicable ability in the list (shown on the left side of the screen) will be activated when you double click on a target. Usually, you can double click on an adjacent vertex to move there (your position is the green ring).

### shared worlds
Players can enter the same shared world and see what others are doing. Some worlds allow more direct interactions than others. There's usually no winning or losing.

### puzzles etc
Single player, smaller worlds with their own sets of abilities and objectives. A new one is created when you choose to enter the world. Puzzles are more focused on mathematical themes, while stories and adventures are less abstract and more like traditional games.