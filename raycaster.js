// raycaster.ts
let term = require('terminal-kit').terminal;
let buffer = require('./display.js').Buffer24;
class Camera {
    constructor() {
        this.location = { x: 0, y: 0 };
        this.fov = 0.575958653127;
        this.angle = 0;
        this.direction = 0;
    }
}
class Entity {
    constructor(x, y, angle, rotSpeed, movSpeed, direction) {
        this.rotSpeed = rotSpeed;
        this.movSpeed = movSpeed;
        this._worldLocation = { x: 0, y: 0 };
        this.camera = new Camera();
        this.worldLocation = { x: x, y: y };
        this.movement = 0;
        this.angle = angle;
        this.direction = direction;
    }
    get worldLocation() {
        return this._worldLocation;
    }
    set worldLocation(loc) {
        this.camera.location.x = this._worldLocation.x = loc.x;
        this.camera.location.y = this._worldLocation.y = loc.y;
    }
    get angle() {
        return this.camera.angle;
    }
    set angle(n) {
        this.camera.angle = n;
    }
    get direction() {
        return this.camera.direction;
    }
    set direction(n) {
        this.camera.direction = n;
    }
}
class Player extends Entity {
    move(keys) {
        this.direction = 0;
        if (keys.left)
            this.direction = -1;
        if (keys.right)
            this.direction = 1;
        if (this.direction != 0)
            this.angle += this.direction * this.rotSpeed;
        // Looks like this is here for keeping rotation within a bounds, can't remember.
        while (this.angle < 0)
            this.angle += 6.283185307179586;
        while (this.angle >= 6.283185307179586)
            this.angle -= 6.283185307179586;
        this.movement = keys.up ? 1 : keys.down ? -1 : 0;
    }
    update(caster) {
        if (this.movement != 0) {
            let nX = this.worldLocation.x + Math.cos(this.angle) * (this.movement * this.movSpeed);
            let nY = this.worldLocation.y + Math.sin(this.angle) * (this.movement * this.movSpeed);
            if (caster.checkMap({ x: nX, y: nY }, false, false) === 0) {
                this.worldLocation = {
                    x: this.worldLocation.x + Math.cos(this.angle) * (this.movement * this.movSpeed),
                    y: this.worldLocation.y + Math.sin(this.angle) * (this.movement * this.movSpeed)
                };
            }
        }
        this.movement = 0;
    }
    constructor(x, y, angle, rotSpeed, movSpeed, direction) {
        super(x, y, angle, rotSpeed, movSpeed, direction);
    }
}
class Input {
    constructor(player) {
        this.player = player;
        let self = this;
        this.keys = { up: false, down: false, left: false, right: false };
        term.grabInput(true);
        term.on('key', function (name, matches, data) {
            if (name === 'CTRL_C') {
                process.exit();
            }
            switch (['UP', 'DOWN', 'LEFT', 'RIGHT'].indexOf(name)) {
                case 0:
                    self.keys.up = true;
                    self.player.move(self.keys);
                    self.keys.up = false;
                    break;
                case 1:
                    self.keys.down = true;
                    self.player.move(self.keys);
                    self.keys.down = false;
                    break;
                case 2:
                    self.keys.left = true;
                    self.player.move(self.keys);
                    self.keys.left = false;
                    break;
                case 3:
                    self.keys.right = true;
                    self.player.move(self.keys);
                    self.keys.right = false;
                    break;
            }
        });
    }
}
class Raycaster {
    constructor(world, cam, surface) {
        this.world = world;
        this.cam = cam;
        this.surface = surface;
        this.updateableEntities = [];
    }
    attachedCamera(camera) {
        // attach a camera to use as a raycasting source
        this.cam = camera;
    }
    checkMap(coordinate, vertical, rayFacingNegative) {
        let x = Math.floor(coordinate.x + (vertical ? (rayFacingNegative ? -1 : 0) : 0)), y = Math.floor(coordinate.y + (!vertical ? (rayFacingNegative ? -1 : 0) : 0)), bounds = (y * this.world.size) + x;
        if (x < this.world.size && y < this.world.size && x >= 0 && y >= 0) {
            if (bounds >= 0 && bounds < this.world.map.length) {
                return this.world.map[bounds];
            }
            else {
                return 1;
            }
        }
        return 2;
    }
    verticalSliceLength(distance, viewDist) {
        return Math.ceil(viewDist / distance);
    }
    calcIntersection(rayAngle, vertical) {
        rayAngle = (rayAngle + this.cam.angle) % 6.283185307179586;
        if (rayAngle < 0)
            rayAngle += 6.283185307179586;
        let rayFacingNegative = (vertical ?
            !(rayAngle > 6.283185307179586 * 0.75 || rayAngle < 6.283185307179586 * 0.25) :
            (rayAngle < 0 || rayAngle > Math.PI));
        let slope = vertical ? Math.sin(rayAngle) / Math.cos(rayAngle) : Math.cos(rayAngle) / Math.sin(rayAngle);
        let Xa = rayFacingNegative ? -1 : 1;
        let Ya = Xa * slope;
        if (!vertical) {
            Ya = rayFacingNegative ? -1 : 1;
            Xa = Ya * slope;
        }
        let isFound = false;
        // This is the first block to check if something is there.
        let initialA = vertical ? (rayFacingNegative ? Math.floor(this.cam.location.x) : Math.ceil(this.cam.location.x)) : (rayFacingNegative ? Math.ceil(this.cam.location.y) : Math.floor(this.cam.location.y)), initialB = vertical ? this.cam.location.y + (initialA - this.cam.location.x) * slope : this.cam.location.x + (initialA - this.cam.location.y) * slope;
        let startingCoordinates = {
            x: vertical ? initialA : initialB,
            y: vertical ? initialB : initialA
        };
        // This doesn't do ceil operator, because we need the precision for texel calcs.
        let takeStep = function (dX, dY, coordinate) {
            coordinate.x += dX;
            coordinate.y += dY;
            return coordinate;
        };
        let tempCoordinates = { x: 0, y: 0 };
        // check for block in coordinates, if so, return that block coordinate
        // if not, take a step and check until it hits or is out of bounds.
        if (vertical ? this.checkMap(startingCoordinates, vertical, rayFacingNegative) != 1 : true)
            while (!isFound) {
                tempCoordinates = takeStep(Xa, Ya, startingCoordinates);
                switch (this.checkMap(tempCoordinates, vertical, rayFacingNegative)) {
                    case 1:
                        startingCoordinates = tempCoordinates;
                        isFound = true;
                        break;
                    case 2:
                        startingCoordinates = { x: -10000, y: -10000 };
                        isFound = true;
                        break;
                    default: break;
                }
            }
        let distanceFromPlayerX = startingCoordinates.x - this.cam.location.x, distanceFromPlayerY = startingCoordinates.y - this.cam.location.y;
        return {
            coordinates: { x: Math.floor(startingCoordinates.x), y: Math.floor(startingCoordinates.y) },
            distance: distanceFromPlayerX * distanceFromPlayerX + distanceFromPlayerY * distanceFromPlayerY,
            actCoords: startingCoordinates
        };
    }
    registerUpdateEntity(updateableEntity) {
        this.updateableEntities.push(updateableEntity);
    }
    render() {
        // View Distance
        let viewDist = (this.world.viewport.w / 2) / Math.tan(this.cam.fov);
        let self = this;
        // Draw each ray column
        for (let rayNumber = 0; rayNumber < this.world.viewport.w; rayNumber++) {
            let rayScreenPos = (-this.world.viewport.w / 2 + rayNumber);
            let rayViewDist = Math.sqrt(rayScreenPos * rayScreenPos + viewDist * viewDist);
            let rayAngle = Math.asin(rayScreenPos / rayViewDist);
            // Get the first hit wall
            let hitBlockH = this.calcIntersection(rayAngle, false), hitBlockV = this.calcIntersection(rayAngle, true);
            let drawRay = function (block, wallType, viewDist) {
                // Draw rays on pseudo-3D map
                let f = false ? block.distance : Math.sqrt(block.distance) * Math.cos(rayAngle) * 2;
                let lineSize = self.verticalSliceLength(f, viewDist), overDraw = Math.floor(lineSize / 2) - (self.world.viewport.h / 2);
                // Cuts off line to avoid overdraw
                if (overDraw > 0)
                    lineSize -= overDraw * 2;
                else
                    overDraw = 0;
                let underDraw = (self.world.viewport.h / 2) - Math.floor(lineSize / 2);
                let drawEnd = (Math.floor(lineSize / 2) + (self.world.viewport.h / 2));
                // Draw the wall, this will go on top of the sky/floor to cover the lower precision of the floor
                let color = wallType == 'x' ? { r: 128, g: 128, b: 128 } : { r: 255, g: 0, b: 255 };
                for (let y = 0; y < lineSize; y++)
                    self.surface.put(rayNumber, (y + underDraw), color);
            };
            let which = (hitBlockH.distance < hitBlockV.distance);
            drawRay(which ? hitBlockH : hitBlockV, which ? 'x' : 'y', viewDist);
        }
        this.surface.render();
        setTimeout(function () {
            self.updateableEntities.forEach(function (obj) {
                obj.update(self);
            });
            self.render();
        }, 34);
    }
}
Raycaster.helper = {
    r2d: function (angle) { return angle * 57.295779513082; },
    d2r: function (angle) { return angle * 0.017453292519; }
};
(function () {
    let sampleMap = [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1,
        1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1,
        1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0, 1,
        1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
        1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1,
        1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1,
        1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1,
        1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1,
        1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1,
        1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1,
        1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1,
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
    ];
    let world = {
        scale: 10,
        size: 30,
        viewport: { w: 320, h: 240 },
        map: sampleMap
    };
    let surface = new buffer(world.viewport.w, world.viewport.h, 10, 10, true);
    term.bold("Welcome to Nodenstein 3D\n");
    term.move(0, 27).bold("Make sure your console is set to atleast 80x300 chars.\n");
    term.move(0, 1).bold("Use arrow keys to move.");
    let p = new Player(1, 28, 0, 0.05, 0.05, 0);
    let i = new Input(p);
    let r = new Raycaster(world, p.camera, surface);
    r.registerUpdateEntity(p);
    r.render();
})();
