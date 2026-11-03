export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3 || gray.length !== width * height) return 0;
  let sum = 0, squares = 0, count = 0;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    const value = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
    sum += value; squares += value * value; count++;
  }
  return Math.max(0, squares / count - (sum / count) ** 2);
}

// Column-major Rz(roll) * Ry(yaw) * Rx(pitch), after removing column scale.
export function poseFromMatrix(matrix: ArrayLike<number>) {
  if (matrix.length !== 16 || Array.from(matrix).some(v => !Number.isFinite(v))) throw new Error('Invalid pose matrix');
  const scale = [0, 4, 8].map(i => Math.hypot(matrix[i], matrix[i + 1], matrix[i + 2]));
  if (scale.some(s => s === 0)) throw new Error('Degenerate pose matrix');
  const at = (row: number, col: number) => matrix[col * 4 + row] / scale[col];
  const yaw = Math.asin(Math.max(-1, Math.min(1, -at(2, 0))));
  const locked = Math.abs(Math.cos(yaw)) < 1e-6;
  const pitch = locked ? Math.atan2(-at(1, 2), at(1, 1)) : Math.atan2(at(2, 1), at(2, 2));
  const roll = locked ? 0 : Math.atan2(at(1, 0), at(0, 0));
  return { yaw: yaw * 180 / Math.PI, pitch: pitch * 180 / Math.PI, roll: roll * 180 / Math.PI };
}

export function faceCrop(points: readonly { x: number; y: number }[], width: number, height: number) {
  if (!points.length || width <= 0 || height <= 0 || points.some(p => !Number.isFinite(p.x + p.y))) return null;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const x = Math.floor(clamp(Math.min(...points.map(p => p.x))) * width);
  const y = Math.floor(clamp(Math.min(...points.map(p => p.y))) * height);
  const right = Math.ceil(clamp(Math.max(...points.map(p => p.x))) * width);
  const bottom = Math.ceil(clamp(Math.max(...points.map(p => p.y))) * height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

export function rollingFps(samples: readonly number[], started: number, now: number): number {
  const from = Math.max(started, now - 10000);
  return now > from ? samples.filter(t => t > from && t <= now).length * 1000 / (now - from) : 0;
}
