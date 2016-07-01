var socket = io.connect('http://' + ip + ':3030');
var currentKing;


function setupSocket (socket) {

    socket.on('otherPlayerJoin', function (otherPlayerData) {
        console.log(otherPlayerData.id + ' has joined!');

        // generate the new players sprites
        for (var unitId in otherPlayerData.units) {
            var unit = otherPlayerData.units[unitId];
            unit.sprite = generateSprite(unit.type, false, otherPlayerData.id);
        }
        otherPlayers[otherPlayerData.id] = otherPlayerData;

    });

    socket.on('otherPlayerDC', function (socketId) {
        console.log(socketId + ' left!');
        delete otherPlayers[socketId];
    });
}

socket.on('newKing', function(newKing){
    currentKing = newKing;
})

function start(){
    $( "#game-ui" ).toggleClass( "display-none" );
    $( "#login-screen" ).toggleClass( "display-none" );
    socket.emit('respawn', {userName: $( "#nick" ).val()});
}

resources.load([
    'img/sprites2.png',
    'img/hero.png',
    'img/terrain.png',
    'img/moneybag.png',
    'img/soldier-asset.png',
    'img/king.png'
]);


resources.onReady(init);

// The main game loop
var lastTime;

function main() {
    var now = Date.now();
    var dt = (now - lastTime) / 1000.0;

    update(dt);
    render();

    lastTime = now;
    requestAnimFrame(main);
};

function init() {
    terrainPattern = ctx.createPattern(resources.get('img/terrain.png'), 'repeat');

    lastTime = Date.now();
    
    socket.on("playersArray", function(playersCollection){
        console.log("all the players", playersCollection)
        otherPlayers = playersCollection;


        /*
        for each of the other players, assign each unit,
        its appropriate sprite
        */

        for (var otherPlayer in otherPlayers){
            if (otherPlayers.hasOwnProperty(otherPlayer)){
                //for each player assign each unit its appropriate sprint
                for (var unitId in otherPlayer.units) {
                    var unit = otherPlayer.units[unitId];
                    unit.sprite = generateSprite(unit.type, false, otherPlayer.id);
                }
            }
        }
    });

    socket.on("gameReady", function(gameData, king) {
        console.log(gameData);
        currentKing = king;
        player = gameData.playerData;
        for (var unitId in player.units) {
            var unit = player.units[unitId];
            unit.sprite = generateSprite(unit.type, true, player.id);
        }
        setupMoneyBags(gameData.moneyBags);
        setupSocket(socket);
        drawViewport();
        main();
    })

    viewCanvas.addEventListener('mousedown', mouseDown, false);
    viewCanvas.addEventListener('mouseup', mouseUp, false);
    viewCanvas.addEventListener('mousemove', mouseMove, false);


    socket.on('moneyBagsUpdate', function (moneyBagsFromServer){
        setupMoneyBags(moneyBagsFromServer);
    })

}

socket.on('deleteAndUpdateMoneyBags', function (bagUpdate) {
    delete moneyBags[bagUpdate.deletedBagName];
    moneyBags[bagUpdate.newBagName] = bagUpdate.newBagValue;
    //abstract this away
    var coords = bagUpdate.newBagName.split(",");
    coords[0] = parseInt(coords[0]);
    coords[1] = parseInt(coords[1]);
    moneyBags[bagUpdate.newBagName].pos = coords;
    moneyBags[bagUpdate.newBagName].sprite = generateSprite("moneybag");
})

// Defines some initial global variables that're overwritten when game loads
var moneyBags = {};

var player = {};

var otherPlayers = {};

var currentSelection = [];


var gameTime = 0;
var terrainPattern;

var score = 200;
var scoreEl = $("#player-wealth-display").text(score);

// Update game objects
function update(dt) {
    gameTime += dt;

    walk(dt);

    handleInput(dt);

    checkCollisions();

    //scoreEl.innerHTML = score;

    socket.emit("playerMoves", player);
    //socket.emit("playerMoves", {id: player.id, unitsPos: getUnitPosByPlayer(player)});

    socket.on("otherPlayerMoves", function(playerData) {
        otherPlayers[playerData.id]=playerData;
        //setUnitPosByPlayer(otherPlayers[playerData.id], playerData.units);
    });

    drawViewport();

};


// function checkPlayerBounds() {
//     // Check bounds

//     player.units.forEach(function(unit){
//         if(unit.pos[0] < 0) {
//             unit.pos[0] = 0;
//         }
//         else if(unit.pos[0] > canvas.width - unit.sprite.size[0]) {
//             unit.pos[0] = canvas.width - unit.sprite.size[0];
//         }

//         if(unit.pos[1] < 0) {
//             unit.pos[1] = 0;
//         }
//         else if(unit.pos[1] > canvas.height - unit.sprite.size[1]) {
//             unit.pos[1] = canvas.height - unit.sprite.size[1];
//         }
//     })
// }

// Draw everything
function render() {
    ctx.fillStyle = terrainPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    renderEntities(player.units, player.id);

    for (var key in otherPlayers){
        if (otherPlayers.hasOwnProperty(key))
            renderEntities(otherPlayers[key].units, key);
    }

    renderSelectionBox();

    renderEntities(moneyBags);
    //cameraPan(currentMousePosition);
};

function renderEntities(list, playerId) {
    if (Array.isArray(list)){
        for(var i=0; i<list.length; i++) {
            renderEntity(list[i], playerId);
        }
    } else if (typeof list === "object") {
        for (var item in list) {
            renderEntity(list[item], playerId);
        }
    }
}

function renderEntity(entity, playerId) {
    ctx.save();
    ctx.translate(entity.pos[0], entity.pos[1]);
    if (!(entity.sprite instanceof Sprite) && entity.sprite){
        entity.sprite.selectable = false;
        Sprite.prototype.render.apply(entity.sprite, [ctx, playerId, entity.type]);
        // entity.sprite.render(ctx);
    }
    else if (entity.sprite){
        entity.sprite.render(ctx, playerId, entity.type);
    }
    ctx.restore();
}

function renderSelectionBox(){
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    ctx.fillRect(rect.startX, rect.startY, rect.w, rect.h);
}


function getUnitPosByPlayer(player){ 
    var posObj = {}; 
    for (var key in player.units){ 
        posObj[key] = player.units[key].pos; 
    } 
    return posObj; 
}

function setUnitPosByPlayer(player, posObj){ 
    for (var unitId in player.units ){ 
        if (posObj[unitId]) 
            //player.units[unitId].pos = posObj[unitId].pos; 
        console.log("prev pos=", player.units[unitId].pos, "new position= ", posObj[unitId].pos )
    }
 }