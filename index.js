var express = require('express');
var app = express();
var path = require('path');
var io = require('socket.io');
var utils = require('./server/utils');
var Player = require('./server/player.constructor');
var Unit = require('./server/unit.constructor').Unit;
var Hero = require('./server/unit.constructor').Hero;
var Soldier = require('./server/unit.constructor').Soldier;
var Bar = require('./server/building.constructor').Bar;
var House = require('./server/building.constructor').House;
var inRange = utils.inRange;

app.use(express.static(__dirname + '/public/'));
app.use(express.static(__dirname + '/browser/'));
app.use(express.static(__dirname + '/node_modules/'));

var gameConfig = require('./config.json');

var spriteSizes = {
    "hero": [34, 50],
    "soldier": [64, 64],
    "moneybag": [33, 36],
    "bar": [320, 288],
    "house": [96, 160],
    "hero_soldier": [108, 114] //this is for the random location function to put soldiers 10 pixels next to heros
}

var CANVAS_SIZE = [3000, 3000]; //Remember to adjust the front end size any time this changes

// all the objects on the canvas
var players = {};
var sockets = {};
var units = {};
var buildings = {};
var moneyBags = {count: 0};
var currentKing;
generateMoneyBags(450);

app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

var server = app.listen(3030, function () {
  console.log('App listening on port 3030!');
});

io = io.listen(server);

io.on('connection', function (socket) {
    console.log("New connection. ID: ", socket.id)
    var currentPlayer = new Player(socket.id);

    sockets[socket.id] = socket;

    socket.on('giveExistingInfo', function () {
        socket.emit('existingInfo', players, moneyBags);
    });

    // when the new user joins!
    socket.on('respawn', function (newPlayerData) {
        currentPlayer.units = {};
        currentPlayer.buildings = {};
        var locations = getRandomLocation();
        var heroLocation = locations["hero"];
        var soldierLocation = locations["soldier"];
        //currentPlayer.userName = randomName();
        currentPlayer.id = socket.id;
        currentPlayer.units[0] = new Hero(heroLocation, socket.id, 0);
        currentPlayer.units[1] = new Soldier(soldierLocation, socket.id, 1);
        currentPlayer.unitNumber = 2;

        addPlayer(currentPlayer);

        //assign current player as king if he is the first one to join
        if (Object.keys(players).length < 2) {
            changeKing(currentPlayer.id);
        }
        socket.emit('gameReady', {playerData: currentPlayer}, currentKing);
        socket.broadcast.emit('otherPlayerJoin', currentPlayer);
        io.emit('leaderboardUpdate', players);
    });

    // socket.on('renameUser', function(data) {
    //     players[data.id].username = data.username;
    // })

    socket.on('chat message', function(msg){
        io.emit('chat message', msg);
    });

    socket.on('disconnect', function () {
        console.log("Disconnected. ID: ", socket.id)
        removePlayer(socket); // removes them from players AND sockets collections

        //if a king disconnects, search again for the new king
        if (socket.id === currentKing){
            if (Object.keys(players).length > 0){
                var currentRichest;
                for (var id in players){
                    if(!currentRichest){
                        currentRichest = players[id];
                    }
                    else if (players[id].wealth > currentRichest.wealth){
                        currentRichest = players[id];
                    }
                }
                changeKing(currentRichest.id);
            }
            else {
                currentKing = undefined;
            }
            socket.broadcast.emit('newKing', currentKing);
        }
        socket.broadcast.emit('otherPlayerDC', socket.id);
        socket.disconnect();
        io.emit('leaderboardUpdate', players);
    });

    socket.on('playerMoves', function (playerData) {
        socket.broadcast.emit('otherPlayerMoves', playerData);
    })

    socket.on('damageDone', function (damageData) {
        var victim = damageData.victim;
        var damage = damageData.damage;
        // console.log(damageData);
        socket.broadcast.emit('takeThat', victim, damage);
        io.emit('leaderboardUpdate', players);
    })

    socket.on('playerDied', function (data) {
        socket.broadcast.emit("notificationPlayerDied", {username: data.username, playerId: data.playerId});
        io.emit('leaderboardUpdate', players);
    });

    socket.on('moneyDiscovered', function (moneyBagData) {
        var currentPlayer = players[moneyBagData.playerId];
        //increase the wealth of the player
        currentPlayer.wealth += moneyBagData.value;
        //and their score
        currentPlayer.score += moneyBagData.value;
        var responseObj =   {wealth: currentPlayer.wealth, score: currentPlayer.score}
        socket.emit('updateScoreAndWealth', responseObj);

        //check if this player's wealth becomes higher than the king's
        if (players[moneyBagData.playerId].wealth > players[currentKing].wealth){
            changeKing(moneyBagData.playerId, currentKing);
            io.emit('newKing', currentKing);
        }

        //change object representing available money on all clients

        var newBagKeyName = generateMoneyBags(1);

        var bagUpdate = {
            deletedBagName: moneyBagData.name,
            newBagName: newBagKeyName.join(","),
            newBagValue: moneyBags[newBagKeyName]
        }
        io.emit('deleteAndUpdateMoneyBags', bagUpdate);
        delete moneyBags[moneyBagData.name];
        //replenish the moneyBags object
        generateMoneyBags(1);
        io.emit('leaderboardUpdate', players);
    })

    socket.on('initialBuildRequest', function (data){
        //if bar
        if (data.request === 1 && data.type === "bar") {
            if (players[data.id].wealth < 2000) {
                //denied
                socket.emit('initialBuildResponse', {valid: false, request: 1, type: "bar"});
            } else {
                //approved
                socket.emit('initialBuildResponse', {valid: true, request: 1, type: "bar"});
            }
        //if house
        } else if (data.request === 1 && data.type === "house") {
            if (players[data.id] && players[data.id].wealth < 1000) {
                //denied
                socket.emit('initialBuildResponse', {valid: false, request: 1, type: "house"});
            } else {
                //approved
                socket.emit('initialBuildResponse', {valid: true, request: 1, type: "house"});
            }
        }
        io.emit('leaderboardUpdate', players);
    });

    socket.on('finalBuildRequest', function (data) {
        if (data.request === 2 && data.type === "bar") {
            if (players[data.id].wealth < 2000) {
                socket.emit('finalBuildResponse', {valid: false, request: 2, error: "lacking resources"});
            } else if (checkCollisions(data.pos, data.type)) {
            //make sure the building doesn't collide with another building
                socket.emit('finalBuildResponse', {valid: false, request: 2, error: "collision"});
            //temporarily set to false because we don't have collision set up
            } else {
                var newBuildingNumber = players[data.id].buildingNumber.toString();
                var newBar = new Bar(data.pos, data.id, newBuildingNumber);
                players[data.id].buildings[newBuildingNumber] = newBar;
                players[data.id].buildingNumber++;
                players[data.id].wealth = players[data.id].wealth - 2000;
                io.emit('finalBuildResponse', { valid: true,
                                                    request: 2,
                                                    buildingObj: newBar,
                                                    name: newBuildingNumber,
                                                    currentWealth: players[data.id].wealth,
                                                    socketId: data.id});
            }
        } else if (data.request === 2 && data.type === "house") {
            if (players[data.id].wealth < 1000) {
                socket.emit('finalBuildResponse', {valid: false, request: 2, error: "lacking resources"});
            } else if (false) {
            //make sure the new building doesn't collide with another building
                socket.emit('finalBuildResponse', {valid: false, request: 2, error: "collision with building"});
            //temporarily set to false because we don't have collision set up
            } else if (false) {
            //make sure the new building doesn't collide with a unit
                socket.emit('finalBuildResponse', {valid: false, request: 2, error: "collision with unit"});
            //temporarily set to false because we don't have collision set up
            } else {
                var newHouse = new House(data.pos, data.id, players[data.id].buildingNumber);
                var newBuildingNumber = players[data.id].buildingNumber;
                players[data.id].buildings[players[data.id].buildingNumber] = newHouse;
                players[data.id].buildingNumber++;
                players[data.id].wealth = players[data.id].wealth - 1000;
                io.emit('finalBuildResponse', { valid: true,
                                                    request: 2,
                                                    buildingObj: newHouse,
                                                    name: newBuildingNumber,
                                                    currentWealth: players[data.id].wealth,
                                                    socketId: data.id});
            }
        }
        io.emit('leaderboardUpdate', players);
    })

    socket.on('hireMercenaryRequest', function (data) {
        //checks to see if player has enough money to buy a merc
        if (players[data.playerId].wealth < 400) {
            socket.emit('hireMercenaryResponse', {valid: false, error: "lacking resources"});
        //checks to see that current max supply would not be surpassed by building another unit
        } else if (players[data.playerId].currentSupply() + 1 > players[data.playerId].currentMaxSupply()) {
            socket.emit('hireMercenaryResponse', {valid: false, error: "surpasses cap"});
        //else if queue is full
        } else if (players[data.playerId].buildings[data.buildingId].productionQueue.length > 3) {
            socket.emit('hireMercenaryResponse', {valid: false, error: "queue full"});
        //else it's a valid request: start building, send updates
        } else {        
            //get x and y coordinates for the new unit
            //add 140 to X, 300 to Y so that unit appears next to door of bar
            var XSpawn = players[data.playerId].buildings[data.buildingId].pos[0] + 140;
            var YSpawn = players[data.playerId].buildings[data.buildingId].pos[1] + 300;
            var spawnLocation = [XSpawn, YSpawn];

            //check to see whether the building has a rendezvous point. If it doesn't, set to undefined
            var rendezvousPoint = players[data.playerId].buildings[data.buildingId].rendezvousPoint || undefined;
            //add to this building's queue
            var newUnit = new Soldier(spawnLocation, data.playerId, players[data.playerId].unitNumber, rendezvousPoint); 

            //update player's available cash on server to reflect purchase of units
            players[data.playerId].wealth = players[data.playerId].wealth - 400;
            socket.emit('updateScoreAndWealth', {wealth: players[data.playerId].wealth});

            socket.emit('addToQueue', {buildingId: data.buildingId, type: "soldier"});
            players[data.playerId].buildings[data.buildingId].productionQueue.push(newUnit);
            //increment the unit number to generate the id for the player's next unit
            players[data.playerId].unitNumber++;
            var progress = 0;
            //this should be cleaned up. Hire unit depends on variables/values above -- bad! 
            function hireUnit(){
                socket.emit('hireMercenaryResponse', {valid: true, progress: progress, buildingId: data.buildingId});
                console.log({valid: true, progress: progress, building: data.buildingId});
                var hireUnitProgress = setTimeout(function(){
                    if (progress < 20) {
                        progress++;
                        hireUnit();
                    } else {
                        //remove the mercenary from the production queue
                        if (players[data.playerId].buildings[data.buildingId].productionQueue.length > 0) {
                            var newUnitForClient = players[data.playerId].buildings[data.buildingId].productionQueue.shift();
                            //add it to the player's unit object
                            players[data.playerId].units[newUnitForClient.id] = newUnitForClient;
                        }
                        //add it to player object on server, and send to client
                        io.emit('mercenaryComplete', {valid: true, newUnit: newUnitForClient, buildingId: data.buildingId});
                        console.log("BUILDING ID", data.buildingId);
                        //if another merc has been added to the queue, do this again
                        if (players[data.playerId].buildings[data.buildingId].productionQueue.length > 0) {
                            progress = 0;
                            hireUnit();
                        //otherwise, reset. no longer currently building, progress is 0
                        } else {
                            players[data.playerId].buildings[data.buildingId].currentlyBuilding = false;
                            progress = 0;
                        }
                    }
                }, 500);
            }
            //check that currentlyBuilding property is false. if currently building, don't need to invoke measure progress again
            if (players[data.playerId].buildings[data.buildingId].currentlyBuilding === false) {
                players[data.playerId].buildings[data.buildingId].currentlyBuilding = true;
                hireUnit();
            }
        }
        io.emit('leaderboardUpdate', players);
    })

    socket.on('newRendezvousPosition', function (data) {
        players[data.playerId].buildings[data.buildingId].rendezvousPoint = data.pos;
    })

});


//for generating money bags for the moneyBags object on server start
function generateMoneyBags(count){
    moneyBags.count = Object.keys(moneyBags).length - 1 + count;
    if (count === 1) {
        var keyName = [utils.getRandomNum(CANVAS_SIZE[0]), utils.getRandomNum(CANVAS_SIZE[1])]
        moneyBags[keyName] = {value : utils.getRandomNum(25, 75)};
        return keyName;

    } else {
        for (var i = 0; i < count; i++) {
            //values of array represent x and y. later, change this so that x = max x of canvas and y is max y of canvas
            moneyBags[[utils.getRandomNum(CANVAS_SIZE[0]), utils.getRandomNum(CANVAS_SIZE[1])]] = {value : utils.getRandomNum(25, 75)};
        }
    }
}

function addPlayer (playerData) {
    players[playerData.id] = playerData;

}

function removePlayer (socket) {
    delete sockets[socket.id];
    delete players[socket.id];
}

function changeKing (newKing, previousKing){
    if(previousKing) players[previousKing].isKing = false;
    players[newKing].isKing = true;
    currentKing = newKing;
}

function checkCollisions (position, type){
    var collision = false;
    for (var id in players){
        for (var unit in players[id].units){
            if (inRange(players[id].units[unit].pos[0], players[id].units[unit].pos[0] + spriteSizes[players[id].units[unit].type][0], position[0], position[0] + spriteSizes[type][0])
                && inRange(players[id].units[unit].pos[1], players[id].units[unit].pos[1] + spriteSizes[players[id].units[unit].type][1], position[1], position[1] + spriteSizes[type][1])){
                collision = true;
            }
        }
        for (var building in players[id].buildings){
            if (inRange(players[id].buildings[building].pos[0], players[id].buildings[building].pos[0] + spriteSizes[players[id].buildings[building].type][0], position[0], position[0] + spriteSizes[type][0]) && inRange(players[id].buildings[building].pos[1], players[id].buildings[building].pos[1] + spriteSizes[players[id].buildings[building].type][1], position[1], position[1] + spriteSizes[type][1])){
                collision = true;
            }
        }
    }
    return collision;
}

//FOR NOW WE ARE ADDING -400 BELOW SO THEY WON'T SHOW UP ON THE UI.
function getRandomLocation (){
    var heroX = utils.getRandomNum(0, CANVAS_SIZE[0] - spriteSizes['hero'][0] - spriteSizes['soldier'][0] - 10 -400);
    var heroY = utils.getRandomNum(0, CANVAS_SIZE[1] - spriteSizes['hero'][1] - spriteSizes['soldier'][1] - 10 -400);
    var soldierX = heroX + spriteSizes['hero'][0] + 10;
    var soldierY = heroY;
    
    while(checkCollisions([heroX, heroY], 'hero_soldier')){
        heroX = utils.getRandomNum(0, CANVAS_SIZE[0] - spriteSizes['hero'][0] -400);
        heroY = utils.getRandomNum(0, CANVAS_SIZE[1] - spriteSizes['hero'][1] -400);
        soldierX = heroX + spriteSizes['hero'][0] + 10;
        soldierY = heroY;
    }
    
    return {
        "hero": [heroX, heroY],
        "soldier": [soldierX, soldierY]
    }
}
