import {
  ClipOp,
  FillType,
  PaintStyle,
  Skia,
  type SkCanvas,
  type SkImage,
  type SkPaint,
  type SkPath,
} from '@shopify/react-native-skia';

/**
 * A Canvas2D-shaped facade over Skia's imperative canvas.
 *
 * The café was written against the browser's CanvasRenderingContext2D, which
 * doesn't exist on iOS or Android. Rather than rewrite every draw call, this
 * implements the subset of the 2D API the café actually uses, so the drawing
 * code stays platform-agnostic and keeps rendering identically on web.
 *
 * Only the operations the café needs are implemented — this is deliberately
 * not a general-purpose polyfill.
 */
export class SkiaCanvas2D {
  private canvas: SkCanvas;
  private path: SkPath;
  private fillPaint: SkPaint;
  private strokePaint: SkPaint;

  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;

  constructor(canvas: SkCanvas) {
    this.canvas = canvas;
    this.path = Skia.Path.Make();

    this.fillPaint = Skia.Paint();
    this.fillPaint.setAntiAlias(true);
    this.fillPaint.setStyle(PaintStyle.Fill);

    this.strokePaint = Skia.Paint();
    this.strokePaint.setAntiAlias(true);
    this.strokePaint.setStyle(PaintStyle.Stroke);
  }

  // Paints are reused across draws rather than allocated per call, since this
  // runs on every frame of the render loop.
  private syncFill(): SkPaint {
    this.fillPaint.setColor(Skia.Color(this.fillStyle));
    return this.fillPaint;
  }

  private syncStroke(): SkPaint {
    this.strokePaint.setColor(Skia.Color(this.strokeStyle));
    this.strokePaint.setStrokeWidth(this.lineWidth);
    return this.strokePaint;
  }

  // ---- state ---------------------------------------------------------

  save() {
    this.canvas.save();
  }

  restore() {
    this.canvas.restore();
  }

  // ---- direct shapes -------------------------------------------------

  clearRect(_x: number, _y: number, _width: number, _height: number) {
    // The café only ever clears the whole surface before a frame.
    this.canvas.clear(Skia.Color('transparent'));
  }

  fillRect(x: number, y: number, width: number, height: number) {
    this.canvas.drawRect(Skia.XYWHRect(x, y, width, height), this.syncFill());
  }

  // ---- path building -------------------------------------------------

  beginPath() {
    this.path = Skia.Path.Make();
    // Canvas2D's default fill rule is nonzero; Skia calls it Winding. The
    // counter shape doubles back on itself, so this materially changes how
    // its serving opening renders.
    this.path.setFillType(FillType.Winding);
  }

  closePath() {
    this.path.close();
  }

  moveTo(x: number, y: number) {
    this.path.moveTo(x, y);
  }

  lineTo(x: number, y: number) {
    this.path.lineTo(x, y);
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.path.quadTo(cpx, cpy, x, y);
  }

  roundRect(x: number, y: number, width: number, height: number, radius: number) {
    this.path.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, width, height), radius, radius));
  }

  arc(
    x: number,
    y: number,
    radius: number,
    _startAngle: number,
    _endAngle: number
  ) {
    // The café only ever draws full circles with arc().
    this.path.addCircle(x, y, radius);
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    _startAngle: number,
    _endAngle: number
  ) {
    const oval = Skia.XYWHRect(x - radiusX, y - radiusY, radiusX * 2, radiusY * 2);

    if (!rotation) {
      this.path.addOval(oval);
      return;
    }

    // Skia has no rotated-oval primitive, so rotate the oval about its own
    // centre via a matrix instead of rotating the whole canvas.
    const rotated = Skia.Path.Make();
    rotated.addOval(oval);
    const m = Skia.Matrix();
    m.translate(x, y);
    m.rotate(rotation);
    m.translate(-x, -y);
    rotated.transform(m);
    this.path.addPath(rotated);
  }

  // ---- painting ------------------------------------------------------

  fill() {
    this.canvas.drawPath(this.path, this.syncFill());
  }

  stroke() {
    this.canvas.drawPath(this.path, this.syncStroke());
  }

  clip() {
    this.canvas.clipPath(this.path, ClipOp.Intersect, true);
  }

  // ---- images --------------------------------------------------------

  drawImage(
    image: SkImage,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number
  ) {
    this.canvas.drawImageRect(
      image,
      Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(dx, dy, dWidth, dHeight),
      this.fillPaint
    );
  }
}

/**
 * The café's draw functions accept this instead of CanvasRenderingContext2D.
 */
export type Ctx2D = SkiaCanvas2D;
