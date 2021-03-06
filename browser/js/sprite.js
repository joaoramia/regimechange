(function() {
    function Sprite(url, pos, size, speed, frames, dir, selectable) {
        this.pos = pos; // Not the same pos as the pos on the canvas
        this.size = size;
        this.speed = typeof speed === 'number' ? speed : 0;
        this.frames = frames;
        this._index = 0;
        this.url = url;
        this.dir = dir || 'horizontal';
        this.selectable = selectable; //selectable if not another player's unit
        this.selected = false;
    };

    Sprite.prototype = {
 
        renderEllipse: function(){
            ctx.beginPath();

            ctx.ellipse(this.size[0]/2, this.size[1], this.size[1]/3, this.size[1]/5, 0, 0, Math.PI*2);

            ctx.fillStyle = this.selected ? "rgba(0, 0, 255, 0.3)" : "rgba(0, 0, 0, 0.3)";

            ctx.fill();
            ctx.closePath();
        },

        render: function(ctx, playerId, type, currentHealth, maxHealth) {
            var frame;

            if(this.speed > 0) {
                var max = this.frames.length;
                var idx = Math.floor(this._index);
                frame = this.frames[idx % max];

                if(this.once && idx >= max) {
                    this.done = true;
                    return;
                }
            }
            else {
                frame = 0;
            }

            var x = this.pos[0];
            var y = this.pos[1];

            if(this.dir == 'vertical') {
                y += frame * this.size[1];
            }
            else {
                x += frame * this.size[0];
            }

            if (this.selectable) this.renderEllipse(); 

            renderHpBar.call(this, currentHealth, maxHealth);
            if (player.id === playerId) renderName.call(this, player.username);
            if (otherPlayers[playerId]) renderName.call(this, otherPlayers[playerId].username);

            if (frame === -1) {
                ctx.drawImage(resources.get(this.url),
                         x, y);
            } else {
                ctx.drawImage(resources.get(this.url),
                         x, y,
                         this.size[0], this.size[1],
                         0, 0,
                         this.size[0], this.size[1]);
            }
        }
    };

    window.Sprite = Sprite;
})();

function renderHpBar (currentHealth, maxHealth) {
    if (this.url === 'img/moneybag.png' || this.url === 'img/damage.png') return;
    ctx.beginPath(); // HP Green for currentHealth
    ctx.strokeStyle = 'black'; // HP Border for maxHealth
    ctx.strokeRect(0, - 10, this.size[0], 5);
    ctx.closePath(); 
    ctx.rect(0, - 10, currentHealth / maxHealth * this.size[0], 5);
    ctx.fillStyle = "rgba(0,128,0, 1)";
    ctx.fill();
}

function renderName (userName) {
    if (this.url === 'img/moneybag.png') return;
    var textMeasure = ctx.measureText(userName);
    var xLocation;

    if (this.size[0] < textMeasure.width) xLocation = (this.size[0] - textMeasure.width);
    if (this.size[0] > textMeasure.width) xLocation = 0;
    
    ctx.font = '12px Arial';
    ctx.fillStyle = 'white';
    ctx.strokeText(userName, xLocation, -20);
    ctx.fillText(userName, xLocation, -20);
}

function generateSprite(type, selectable, playerId){
    selectable = selectable || false;

    if (currentKing){
        if (type === 'hero' && playerId === currentKing){
            return new Sprite('img/hero/king.png', [0, 105], [34, 50], 10, [0, 1, 2, 3], 'horizontal', selectable);
        } else if (type === 'soldier' && playerId === currentKing) {
            return new Sprite('img/cop-asset.png', [0, 0], [64, 64], 1, [0, 1, 2, 3, 4, 5, 6, 7], 'horizontal', selectable);
        }
    }

    if (type === 'hero') {
       return new Sprite('img/hero/hero-1.png', [32, 0], [32, 55], 16, [0, 1, 2], 'horizontal', selectable);
    } else if (type === 'soldier') {
        return new Sprite('img/soldier-asset.png', [0, 0], [64, 64], 1, [0, 1, 2, 3, 4, 5, 6, 7], 'horizontal', selectable);
    } else if (type === 'moneybag') {
        return new Sprite('img/moneybag.png', [0,0], [33,36], 1, [0], false);
    } else if (type === 'bar') {
        return new Sprite('img/bar-asset.png', [0,0], [320, 288], 1, [0], true);
    } else if (type === 'house') {
        return new Sprite('img/house-asset.png', [0,0], [96, 160], 1, [0], true);
    } else if (type === 'explosion') {
        return new Sprite('img/damage.png', [0, 0], [20, 20], 16, [0, 1, 2, 3, 4], 'horizontal', false);
    }
}
