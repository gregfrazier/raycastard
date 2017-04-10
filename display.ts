// display.ts

let term = require('terminal-kit').terminal;

interface Color {
  r: number;
  g: number;
  b: number;
}

interface AsciiBlock {
  color: Color;
  char: string;
}

class Buffer24 {
  screen: Array<number>;
  chars: Array<string> = ['_', 'Â·', 'o', ':', 'O', '8', '#', '@'];
  bufferHeightSize: number;
  bufferWidthSize: number;
  fullBufferSize: number;
  constructor(public width: number, public height: number,
              public charWidth: number, public charHeight: number, public autoclear: boolean = true)
  {
    this.bufferHeightSize = this.height / this.charHeight;
    this.bufferWidthSize = this.width / this.charWidth;
    this.fullBufferSize = this.bufferHeightSize * this.bufferWidthSize;
    this.screen = new Uint8Array((width * 3) * height).fill(0);
  }
  luma(color: Color) {
    return (.27 * color.r) + (.67 * color.g) + (.06 * color.b);
  }
  put(x: number, y: number, color: Color) {
    if(y >= this.height) { y = this.height-1; }
    let idx = (x + (this.width * y)) * 3; // 24-bit color space
    this.screen[idx] = color.r;
    this.screen[idx+1] = color.g;
    this.screen[idx+2] = color.b;
  }
  get(x: number, y: number) : Color {
    let idx = (x + (this.width * y)) * 3;
    return { r: this.screen[idx], g: this.screen[idx+1], b: this.screen[idx+2] };
  }
  getBlock(n: number) : AsciiBlock {
    let row = Math.floor(n / this.bufferWidthSize);
    let col = n % (this.bufferWidthSize);
    let xOffset = this.charWidth * col;
    let yOffset = this.charHeight * row;
    let avgColor = { r:0, g:0, b:0, lum: 0 };
    let avgDiv = this.charWidth * this.charHeight;
    for(let x = xOffset; x < xOffset + this.charWidth; x++){
      for(let y = yOffset; y < yOffset + this.charHeight; y++){
        let pointColor = this.get(x, y);
        avgColor.r += pointColor.r;
        avgColor.g += pointColor.g;
        avgColor.b += pointColor.b;
        avgColor.lum += this.luma(pointColor);
      }
    }
    avgColor.r = (avgColor.r / avgDiv) | 0;
    avgColor.g = (avgColor.g / avgDiv) | 0;
    avgColor.b = (avgColor.b / avgDiv) | 0;
    avgColor.lum = (avgColor.lum / avgDiv) | 0;
    return { color: avgColor, char: this.chars[Math.floor(avgColor.lum/32)] };
  }
  render() {
    term.moveTo(0,0);
    for(let i = 0; i < this.fullBufferSize; i++){
      if(i % this.bufferWidthSize === 0)
        term("\n");
      let t = this.getBlock(i);
      term.colorRgb(t.color.r, t.color.g, t.color.b)(t.char);
    }
    if(this.autoclear)
      this.screen.fill(0);
  }
}

exports.Buffer24 = Buffer24;