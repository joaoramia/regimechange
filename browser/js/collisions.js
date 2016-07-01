// Collisions

function collides(x, y, r, b, x2, y2, r2, b2) {
    return !(r <= x2 || x > r2 ||
             b <= y2 || y > b2);
}

function boxCollides(pos, size, pos2, size2) {
    return inRange(pos[0], pos[0] + size[0], pos2[0], pos2[0] + size2[0]) 
           && inRange(pos[1], pos[1] + size[1], pos2[1], pos2[1] + size2[1]);
    /*return collides(pos[0], pos[1],
                    pos[0] + size[0], pos[1] + size[1],
                    pos2[0], pos2[1],
                    pos2[0] + size2[0], pos2[1] + size2[1]);
*/
}



function checkCollisions() {
    // checkPlayerBounds();
    checkCollisionWithMoneyBag();

    // Run collision detection for all enemies and bullets
    // for(var i=0; i<enemies.length; i++) {
    //     var pos = enemies[i].pos;
    //     var size = enemies[i].sprite.size;

    //     for(var j=0; j<bullets.length; j++) {
    //         var pos2 = bullets[j].pos;
    //         var size2 = bullets[j].sprite.size;

    //         if(boxCollides(pos, size, pos2, size2)) {
    //             // Remove the enemy
    //             enemies.splice(i, 1);
    //             i--;

    //             // Add score
    //             score += 100;

    //             // Add an explosion
    //             explosions.push({
    //                 pos: pos,
    //                 sprite: new Sprite('img/sprites.png',
    //                                    [0, 117],
    //                                    [39, 39],
    //                                    16,
    //                                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    //                                    null,
    //                                    true)
    //             });

    //             // Remove the bullet and stop this iteration
    //             bullets.splice(j, 1);
    //             break;
    //         }
    //     }

    //     if(boxCollides(pos, size, player.pos, player.sprite.size)) {
    //         gameOver();
    //     }
    // }
}


