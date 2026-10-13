// Draws a flat render of the card through its CSS 3D transform. WebKit paints transformed elements inside
// an exported SVG without perspective (and with broken shadows), so tilted cards are projected here instead.

/** A 3×3 projective matrix, row-major. */
type Homography = number[];

function multiply(a: Homography, b: Homography): Homography {
  const out: number[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++)
      out.push(a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col]);
  return out;
}

function invert([a, b, c, d, e, f, g, h, i]: Homography): Homography {
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A, c * h - b * i, b * f - c * e, B, a * i - c * g, c * d - a * f, C, b * g - a * h, a * e - b * d].map(
    (v) => v / det,
  );
}

function apply(m: Homography, x: number, y: number): [number, number] {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

/**
 * Maps pixels of a flat render of `element` (padded by `pad` on every side, at `sourceRatio`) to pixels of
 * a render of `frame` (at `targetRatio`), through the element's computed transform.
 */
export function projection(
  element: HTMLElement,
  frame: HTMLElement,
  { pad, sourceRatio, targetRatio }: { pad: number; sourceRatio: number; targetRatio: number },
): Homography {
  const style = getComputedStyle(element);
  const m = new DOMMatrix(style.transform);
  const [originX, originY] = style.transformOrigin.split(" ").map(parseFloat);
  // Untransformed position inside the frame. Offsets ignore transforms, including the preview's scale.
  let left = 0;
  let top = 0;
  for (let el: HTMLElement | null = element; el && el !== frame; el = el.offsetParent as HTMLElement | null) {
    left += el.offsetLeft;
    top += el.offsetTop;
  }
  // Source pixel -> point relative to the transform origin.
  const fromSource = [1 / sourceRatio, 0, -pad - originX, 0, 1 / sourceRatio, -pad - originY, 0, 0, 1];
  // The transform, for points on the element's own plane (z = 0).
  const transform = [m.m11, m.m21, m.m41, m.m12, m.m22, m.m42, m.m14, m.m24, m.m44];
  const toTarget = [
    targetRatio, 0, targetRatio * (originX + left),
    0, targetRatio, targetRatio * (originY + top),
    0, 0, 1,
  ];
  return multiply(toTarget, multiply(transform, fromSource));
}

// Four samples per output pixel, so text that the tilt shrinks stays smooth instead of shimmering.
const SAMPLES = [0.25, 0.75];

/** Composites `source` over `target`, warped by `toTarget` (source pixels -> target pixels). */
export function drawProjected(target: HTMLCanvasElement, source: HTMLCanvasElement, toTarget: Homography) {
  const { width: sw, height: sh } = source;
  const corners = [apply(toTarget, 0, 0), apply(toTarget, sw, 0), apply(toTarget, 0, sh), apply(toTarget, sw, sh)];
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))));
  const x1 = Math.min(target.width, Math.ceil(Math.max(...corners.map((p) => p[0]))));
  const y1 = Math.min(target.height, Math.ceil(Math.max(...corners.map((p) => p[1]))));
  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0) return;

  const src = source.getContext("2d")!.getImageData(0, 0, sw, sh).data;
  const out = new ImageData(width, height);
  const dst = out.data;
  const [a, b, c, d, e, f, g, h, i] = invert(toTarget);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Premultiplied sums, so transparent edges don't bleed dark fringes into the colour.
      let r = 0;
      let gr = 0;
      let bl = 0;
      let al = 0;
      for (const oy of SAMPLES) {
        for (const ox of SAMPLES) {
          const X = x0 + px + ox;
          const Y = y0 + py + oy;
          const w = g * X + h * Y + i;
          // Texel centres sit at half pixels; anything past the edge counts as transparent.
          const u = (a * X + b * Y + c) / w - 0.5;
          const v = (d * X + e * Y + f) / w - 0.5;
          const ix = Math.floor(u);
          const iy = Math.floor(v);
          if (ix < -1 || iy < -1 || ix >= sw || iy >= sh) continue;
          const fx = u - ix;
          const fy = v - iy;
          for (let k = 0; k < 4; k++) {
            const tx = ix + (k & 1);
            const ty = iy + (k >> 1);
            if (tx < 0 || ty < 0 || tx >= sw || ty >= sh) continue;
            const weight = (k & 1 ? fx : 1 - fx) * (k >> 1 ? fy : 1 - fy);
            const at = (ty * sw + tx) * 4;
            const alpha = src[at + 3] * weight;
            r += src[at] * alpha;
            gr += src[at + 1] * alpha;
            bl += src[at + 2] * alpha;
            al += alpha;
          }
        }
      }
      if (al === 0) continue;
      const at = (py * width + px) * 4;
      dst[at] = r / al;
      dst[at + 1] = gr / al;
      dst[at + 2] = bl / al;
      dst[at + 3] = al / (SAMPLES.length * SAMPLES.length);
    }
  }

  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  layer.getContext("2d")!.putImageData(out, 0, 0);
  target.getContext("2d")!.drawImage(layer, x0, y0);
  // Free it now; iOS caps the memory all canvases on a page can hold.
  layer.width = layer.height = 0;
}
