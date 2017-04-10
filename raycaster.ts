// raycaster.ts
let term = require('terminal-kit').terminal;
let buffer = require('./display.js').Buffer24;

interface Dims {
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

interface WorldDefinition {
  scale: number;
  size: number;
  viewport: Dims;
  map: Uint8Array;
}

interface IntersectDetails {
  coordinates: Point;
  actCoords: Point;
  distance: number;
}

interface Keyboard {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

class Camera {
  location: Point;
  fov: number;
  angle: number;
  direction: number;
  constructor() {
    this.location = { x: 0, y: 0 };
    this.fov = 0.575958653127;
    this.angle = 0;
    this.direction = 0;
  }
}

abstract class Entity {
  camera: Camera;
  private _worldLocation: Point = { x: 0, y: 0 };
  get worldLocation(): Point {
    return this._worldLocation;
  }
  set worldLocation(loc: Point) {
    this.camera.location.x = this._worldLocation.x = loc.x;
    this.camera.location.y = this._worldLocation.y = loc.y;
  }
  get angle(): number {
    return this.camera.angle;
  }
  set angle(n: number) {
    this.camera.angle = n;
  }
  get direction(): number {
    return this.camera.direction;
  }
  set direction(n: number) {
    this.camera.direction = n;
  }
  abstract update(caster: Raycaster): void;
  movement: number;
  constructor(x: number, y: number, angle: number, public rotSpeed: number, public movSpeed: number, direction: number) {
    this.camera = new Camera();
    this.worldLocation = { x: x, y: y };
    this.movement = 0;
    this.angle = angle;
    this.direction = direction;
  }
}

class Player extends Entity {
  move(keys: Keyboard) {
    this.direction = 0;
    if(keys.left) this.direction = -1;
    if(keys.right) this.direction = 1;
    if(this.direction != 0) this.angle += this.direction * this.rotSpeed;

    // Looks like this is here for keeping rotation within a bounds, can't remember.
    while (this.angle < 0) this.angle += 6.283185307179586;
    while (this.angle >= 6.283185307179586) this.angle -= 6.283185307179586;

    this.movement = keys.up ? 1 : keys.down ? -1 : 0;
  }
  update(caster: Raycaster) : void {
    if(this.movement != 0){
      let nX = this.worldLocation.x + Math.cos(this.angle) * (this.movement * this.movSpeed);
      let nY = this.worldLocation.y + Math.sin(this.angle) * (this.movement * this.movSpeed);
      if(caster.checkMap({x: nX, y: nY}, false, false) === 0){
        this.worldLocation = {
          x: this.worldLocation.x + Math.cos(this.angle) * (this.movement * this.movSpeed),
          y: this.worldLocation.y + Math.sin(this.angle) * (this.movement * this.movSpeed)
        };
      }
    }
    this.movement = 0;
  }
  constructor(x: number, y: number, angle: number, rotSpeed: number, movSpeed: number, direction: number) {
    super(x, y, angle, rotSpeed, movSpeed, direction);
  }
}

class Input {
  keys: Keyboard;
  constructor(public player: Player) {
    let self = this;
    this.keys = { up: false, down: false, left: false, right: false };
    term.grabInput(true);
    term.on('key', function(name: string, matches: any, data: any) {
      if ( name === 'CTRL_C' ) { process.exit() ; }
      switch(['UP','DOWN','LEFT','RIGHT'].indexOf(name)) {
        case 0: self.keys.up = true; self.player.move(self.keys); self.keys.up = false; break;
        case 1: self.keys.down = true; self.player.move(self.keys); self.keys.down = false; break;
        case 2: self.keys.left = true; self.player.move(self.keys); self.keys.left = false; break;
        case 3: self.keys.right = true; self.player.move(self.keys); self.keys.right = false; break;
      }
    }) ;
  }
}

class Raycaster {
    updateableEntities: Array<Entity>;
    constructor(public world: WorldDefinition, public cam: Camera, public surface: any) {
      this.updateableEntities = [];
    }
    static helper: any = {
      r2d: function(angle){ return angle * 57.295779513082; },
      d2r: function(angle){ return angle * 0.017453292519; }
    };
    attachedCamera(camera: Camera): void {
      // attach a camera to use as a raycasting source
      this.cam = camera;
    }
    checkMap(coordinate: Point, vertical: boolean, rayFacingNegative: boolean): number {
      let x: number = Math.floor(coordinate.x + (vertical ? (rayFacingNegative ? -1 : 0): 0)),
          y: number = Math.floor(coordinate.y + (!vertical ? (rayFacingNegative ? -1 : 0): 0)),
          bounds: number = (y * this.world.size) + x;
      if(x < this.world.size && y < this.world.size && x >= 0 && y >= 0) {
        if(bounds >= 0 && bounds < this.world.map.length) {
          return this.world.map[bounds];
        } else {
          return 1;
        }
      }
      return 2;
    }
    verticalSliceLength(distance: number, viewDist: number): number {
      return Math.ceil(viewDist / distance);
    }
    calcIntersection(rayAngle: number, vertical: boolean) : IntersectDetails {
      rayAngle = (rayAngle + this.cam.angle) % 6.283185307179586;
      if(rayAngle < 0) rayAngle += 6.283185307179586;
      let rayFacingNegative: boolean = (vertical ?
                  !(rayAngle > 6.283185307179586 * 0.75 || rayAngle < 6.283185307179586 * 0.25) :
                  (rayAngle < 0 || rayAngle > Math.PI));
      let slope: number = vertical ? Math.sin(rayAngle) / Math.cos(rayAngle) : Math.cos(rayAngle) / Math.sin(rayAngle);

      let Xa: number = rayFacingNegative ? -1 : 1;
      let Ya: number = Xa * slope;
      if(!vertical) {
        Ya = rayFacingNegative ? -1 : 1;
        Xa = Ya * slope;
      }
      let isFound:boolean = false;

      // This is the first block to check if something is there.
      let initialA: number = vertical ? (rayFacingNegative ? Math.floor(this.cam.location.x) : Math.ceil(this.cam.location.x)) : (rayFacingNegative ? Math.ceil(this.cam.location.y) : Math.floor(this.cam.location.y)),
          initialB: number = vertical ? this.cam.location.y + (initialA - this.cam.location.x) * slope : this.cam.location.x + (initialA - this.cam.location.y) * slope;
      let startingCoordinates: Point = {
        x: vertical ? initialA : initialB,
        y: vertical ? initialB : initialA
      };

      // This doesn't do ceil operator, because we need the precision for texel calcs.
      let takeStep = function(dX: number, dY: number, coordinate: Point){
        coordinate.x += dX;
        coordinate.y += dY;
        return coordinate;
      };

      let tempCoordinates: Point = { x: 0, y: 0 };
      // check for block in coordinates, if so, return that block coordinate
      // if not, take a step and check until it hits or is out of bounds.
      if(vertical ? this.checkMap(startingCoordinates, vertical, rayFacingNegative) != 1 : true)
        while(!isFound){
          tempCoordinates = takeStep(Xa, Ya, startingCoordinates);
          switch(this.checkMap(tempCoordinates, vertical, rayFacingNegative))
          {
            case 1: startingCoordinates = tempCoordinates; isFound = true; break;
            case 2: startingCoordinates = { x: -10000, y: -10000 }; isFound = true; break;
            default: break;
          }
        }

      let distanceFromPlayerX: number = startingCoordinates.x - this.cam.location.x,
          distanceFromPlayerY: number = startingCoordinates.y - this.cam.location.y;

      return {
        coordinates: { x: Math.floor(startingCoordinates.x), y: Math.floor(startingCoordinates.y) },
        distance: distanceFromPlayerX * distanceFromPlayerX + distanceFromPlayerY * distanceFromPlayerY,
        actCoords: startingCoordinates
      };
    }
    registerUpdateEntity(updateableEntity: Entity) {
      this.updateableEntities.push(updateableEntity);
    }
    render() {
  		// View Distance
  		let viewDist: number = (this.world.viewport.w / 2) / Math.tan(this.cam.fov);
      let self = this;

  		// Draw each ray column
  		for(let rayNumber: number = 0; rayNumber < this.world.viewport.w; rayNumber++)
  		{
  			let rayScreenPos: number = (-this.world.viewport.w/2 + rayNumber);
  			let rayViewDist: number = Math.sqrt(rayScreenPos*rayScreenPos + viewDist*viewDist);
  			let rayAngle: number = Math.asin(rayScreenPos / rayViewDist);

  			// Get the first hit wall
  			let hitBlockH: IntersectDetails = this.calcIntersection(rayAngle, false),
  				  hitBlockV: IntersectDetails = this.calcIntersection(rayAngle, true);

  			let drawRay = function(block: any, wallType: any, viewDist: number) {
  				// Draw rays on pseudo-3D map
  				let f: number = false ? block.distance : Math.sqrt(block.distance) * Math.cos(rayAngle) * 2;
          let lineSize: number = self.verticalSliceLength(f, viewDist),
  					  overDraw: number = Math.floor(lineSize / 2) - (self.world.viewport.h/2);

  				// Cuts off line to avoid overdraw
  				if(overDraw > 0)
  					lineSize -= overDraw * 2;
  				else
  					overDraw = 0;

  				let underDraw: number = (self.world.viewport.h/2) - Math.floor(lineSize/2);

  				let drawEnd: number = (Math.floor(lineSize / 2) + (self.world.viewport.h/2));

  				// Draw the wall, this will go on top of the sky/floor to cover the lower precision of the floor
          let color: any = wallType == 'x' ? { r: 128, g: 128, b: 128 } : { r: 255, g: 0, b: 255 };
          for(let y: number = 0; y < lineSize; y++)
            self.surface.put(rayNumber, (y + underDraw), color);
  			};

  			let which: boolean = (hitBlockH.distance < hitBlockV.distance);
  			drawRay(which ? hitBlockH : hitBlockV, which ? 'x' : 'y', viewDist);
  		}

      this.surface.render();
      setTimeout(function(){
        self.updateableEntities.forEach(function(obj){
          obj.update(self);
        });
        self.render();
      }, 34);
  	}
}

(function(){
  let sampleMap: Uint8Array = [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,1,0,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,1,0,0,0,0,0,0,0,1,
    1,0,0,1,1,1,0,1,0,1,1,1,0,0,1,0,1,1,1,1,0,1,1,1,1,1,1,1,0,1,
    1,0,0,1,0,0,0,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,
    1,0,0,1,0,1,0,1,1,1,1,1,0,0,1,0,0,0,1,1,0,1,1,1,0,0,1,0,0,1,
    1,0,0,1,0,1,0,0,0,0,0,1,0,0,1,0,1,1,1,0,0,0,0,1,0,1,1,0,0,1,
    1,1,0,1,0,1,1,1,1,0,1,1,1,0,1,0,1,0,0,0,1,1,1,1,0,0,1,0,0,1,
    1,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,
    1,0,0,1,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,0,1,0,0,1,1,1,1,1,0,1,
    1,0,1,1,0,1,0,0,1,1,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,1,1,0,1,0,0,0,0,0,1,0,0,0,0,0,1,1,1,1,1,1,1,1,0,1,
    1,1,0,0,0,1,0,0,1,1,1,1,1,0,1,0,0,1,0,0,1,0,0,1,0,0,0,1,0,1,
    1,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,1,
    1,0,0,1,0,1,0,0,0,1,1,1,1,1,0,0,0,1,1,0,1,0,0,0,0,0,0,1,0,1,
    1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,0,1,0,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,
    1,0,1,1,1,1,1,1,0,0,0,1,1,1,0,1,1,1,1,0,1,0,1,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,1,1,1,1,1,0,1,0,0,1,0,1,0,1,0,1,1,1,1,1,0,0,1,
    1,0,1,1,1,1,0,0,0,0,1,0,0,1,0,0,1,0,1,0,1,0,0,0,0,0,1,0,0,1,
    1,0,0,1,0,0,0,0,0,1,1,0,0,1,0,0,1,0,0,0,1,0,0,1,1,1,1,0,0,1,
    1,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,1,
    1,0,1,1,1,0,0,1,1,0,0,1,1,1,1,1,0,0,1,1,1,1,1,1,0,0,1,0,0,1,
    1,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,
    1,0,0,1,0,1,0,0,0,0,1,1,0,1,1,1,0,1,1,0,0,0,1,0,0,0,1,0,0,1,
    1,0,0,1,0,0,0,0,1,1,1,0,0,0,1,0,0,0,1,1,1,0,1,0,1,1,1,0,0,1,
    1,0,1,1,1,1,1,1,1,0,0,0,1,1,1,0,1,0,0,0,1,1,1,1,1,0,0,0,0,1,
    1,0,1,0,0,1,0,0,0,0,1,1,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1
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