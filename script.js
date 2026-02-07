/*
 * A simple 2D motorcycle game inspired by Gravity Defied.
 *
 * This implementation avoids external dependencies by providing its own
 * lightweight physics.  The bike is composed of two wheels connected
 * by a rigid bar.  Gravity pulls the wheels down, collisions with a
 * procedurally generated track prevent them from falling through, and
 * user input accelerates, brakes and tilts the bike.  A basic
 * camera scrolls horizontally to follow the action.
 */

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Adjust canvas size to fill available space.  The height is computed
  // by subtracting the control panel height, which is measured after
  // DOMContentLoaded.  On resize, update the canvas accordingly.
  function resize() {
    const controls = document.getElementById('controls');
    const controlHeight = controls.getBoundingClientRect().height;
    const width = window.innerWidth;
    const height = window.innerHeight - controlHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  /*
   * Track generation
   *
   * The track is represented as an array of segments, each with a
   * starting x coordinate, a starting y coordinate and a slope (rise
   * over run).  Segments are of equal length.  To create some
   * variation in the terrain we use random slopes and a sine wave.
   */
  const track = [];
  (function generateTrack() {
    const segmentLength = 400;
    let x = 0;
    let y = canvas.height / (window.devicePixelRatio || 1) - 80; // start near bottom
    for (let i = 0; i < 50; i++) {
      const slope = (Math.random() - 0.5) * 0.4; // small slope between -0.2 and 0.2
      track.push({ x, y, slope, length: segmentLength });
      // update y for next segment using the slope
      y = y + slope * segmentLength;
      x += segmentLength;
    }
  })();

  // Return the height of the track directly beneath a given x coordinate
  function getTrackY(x) {
    for (let i = 0; i < track.length; i++) {
      const seg = track[i];
      if (x >= seg.x && x <= seg.x + seg.length) {
        return seg.y + seg.slope * (x - seg.x);
      }
    }
    // If x is beyond the last segment, extend the last segment
    const last = track[track.length - 1];
    return last.y + last.slope * (x - last.x);
  }
  // Return the slope of the track beneath a given x coordinate
  function getTrackSlope(x) {
    for (let i = 0; i < track.length; i++) {
      const seg = track[i];
      if (x >= seg.x && x <= seg.x + seg.length) {
        return seg.slope;
      }
    }
    return track[track.length - 1].slope;
  }

  /*
   * Bike definition
   *
   * Each wheel is represented by a simple object containing its
   * position, velocity and mass (mass is currently unused but
   * included for extensibility).  The distance between the two
   * wheels is enforced to remain constant each frame, representing
   * the rigid frame of the bike.
   */
  const wheelRadius = 20;
  const wheelDistance = 60;
  const wheelA = { x: 150, y: getTrackY(150) - wheelRadius, vx: 0, vy: 0, m: 1 };
  const wheelB = { x: 150 + wheelDistance, y: getTrackY(150 + wheelDistance) - wheelRadius, vx: 0, vy: 0, m: 1 };

  // Input state
  let accelerate = false;
  let brake      = false;
  let tiltLeft   = false;
  let tiltRight  = false;

  // Keyboard event handlers
  function onKeyDown(e) {
    switch (e.code) {
      case 'ArrowRight':
      case 'KeyD': accelerate = true; break;
      case 'ArrowLeft':
      case 'KeyA': brake = true; break;
      case 'ArrowDown':
      case 'KeyS': tiltLeft = true; break;
      case 'ArrowUp':
      case 'KeyW': tiltRight = true; break;
    }
  }
  function onKeyUp(e) {
    switch (e.code) {
      case 'ArrowRight':
      case 'KeyD': accelerate = false; break;
      case 'ArrowLeft':
      case 'KeyA': brake = false; break;
      case 'ArrowDown':
      case 'KeyS': tiltLeft = false; break;
      case 'ArrowUp':
      case 'KeyW': tiltRight = false; break;
    }
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // On‑screen button helper
  function setupButton(id, onPress, onRelease) {
    const el = document.getElementById(id);
    el.addEventListener('mousedown', (e) => { e.preventDefault(); onPress(); });
    el.addEventListener('touchstart', (e) => { e.preventDefault(); onPress(); });
    ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev => {
      el.addEventListener(ev, (e) => { e.preventDefault(); onRelease(); });
    });
  }
  setupButton('btnAccelerate', () => { accelerate = true;  }, () => { accelerate = false;  });
  setupButton('btnBrake',      () => { brake = true;       }, () => { brake = false;       });
  setupButton('btnTiltLeft',   () => { tiltLeft = true;    }, () => { tiltLeft = false;    });
  setupButton('btnTiltRight',  () => { tiltRight = true;   }, () => { tiltRight = false;   });

  // Physics parameters
  const gravity = 1200;     // pixels per second^2
  const engineForce = 1000; // acceleration when holding gas (px/s^2)
  const brakeForce  = -800; // deceleration when braking (px/s^2)
  const friction    = 0.98; // horizontal velocity damping on contact
  const tiltStep    = 0.06; // radians of rotation per frame when tilting

  // Utility: rotate the bike by a small angle around its midpoint
  function rotateBike(angle) {
    // Compute midpoint
    const cx = (wheelA.x + wheelB.x) / 2;
    const cy = (wheelA.y + wheelB.y) / 2;
    // Rotate each wheel
    [wheelA, wheelB].forEach(wheel => {
      const dx = wheel.x - cx;
      const dy = wheel.y - cy;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      wheel.x = cx + rx;
      wheel.y = cy + ry;
    });
  }

  // Enforce the rigid bar constraint between wheels by nudging their
  // positions so that the distance remains constant.  Without this
  // correction the bike frame would stretch over time.
  function enforceConstraint() {
    const dx = wheelB.x - wheelA.x;
    const dy = wheelB.y - wheelA.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const diff = dist - wheelDistance;
    if (Math.abs(diff) > 0.0001) {
      // Normalise the vector and split the correction between wheels
      const corrX = (dx / dist) * diff * 0.5;
      const corrY = (dy / dist) * diff * 0.5;
      wheelA.x += corrX;
      wheelA.y += corrY;
      wheelB.x -= corrX;
      wheelB.y -= corrY;
    }
  }

  // Handle collision of a single wheel with the track.  If the wheel
  // penetrates the track, reposition it to sit on top of the track and
  // remove its downward velocity.  Apply friction to horizontal
  // velocity to simulate rolling resistance.
  function handleCollision(w) {
    const trackY = getTrackY(w.x);
    if (w.y + wheelRadius > trackY) {
      // Place wheel on track
      w.y = trackY - wheelRadius;
      // Stop downward motion
      if (w.vy > 0) w.vy = 0;
      // Apply friction only when in contact with the ground
      w.vx *= friction;
      // Adjust velocity to follow the slope: part of horizontal velocity
      const slope = getTrackSlope(w.x);
      const normalAngle = Math.atan(slope);
      // Optionally project velocity onto the slope direction
      const v = Math.sqrt(w.vx * w.vx + w.vy * w.vy);
      const dir = Math.atan2(w.vy, w.vx);
      // Align velocity with slope (simple approximation)
      const aligned = dir * 0.8 + normalAngle * 0.2;
      w.vx = v * Math.cos(aligned);
      w.vy = v * Math.sin(aligned);
    }
  }

  // Main update loop
  let lastTime = null;
  function update(time) {
    if (!lastTime) lastTime = time;
    const dt = (time - lastTime) / 1000; // convert to seconds
    lastTime = time;
    // Cap dt to avoid huge leaps when tab is hidden
    const clampedDt = Math.min(dt, 0.033);

    // Apply gravity
    wheelA.vy += gravity * clampedDt;
    wheelB.vy += gravity * clampedDt;
    // Apply engine/braking forces along horizontal axis
    if (accelerate) {
      wheelA.vx += (engineForce * clampedDt);
      wheelB.vx += (engineForce * clampedDt);
    }
    if (brake) {
      wheelA.vx += (brakeForce * clampedDt);
      wheelB.vx += (brakeForce * clampedDt);
    }

    // Integrate positions
    wheelA.x += wheelA.vx * clampedDt;
    wheelA.y += wheelA.vy * clampedDt;
    wheelB.x += wheelB.vx * clampedDt;
    wheelB.y += wheelB.vy * clampedDt;

    // Enforce constraint between wheels
    enforceConstraint();

    // Collision detection and response
    handleCollision(wheelA);
    handleCollision(wheelB);

    // Tilt bike if requested
    if (tiltLeft)  rotateBike(-tiltStep);
    if (tiltRight) rotateBike( tiltStep);

    // Draw the scene
    draw();
    requestAnimationFrame(update);
  }

  // Draw track and bike.  A horizontal offset is applied so the bike
  // remains roughly one quarter of the screen from the left.  This
  // gives the illusion of scrolling terrain.
  function draw() {
    const width  = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    // Determine camera offset
    const targetX = wheelA.x;
    const offsetX = width * 0.25 - targetX;
    ctx.save();
    // Clear background
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);
    ctx.translate(offsetX, 0);
    // Draw track as a series of lines
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < track.length; i++) {
      const seg = track[i];
      const x0 = seg.x;
      const y0 = seg.y;
      const x1 = seg.x + seg.length;
      const y1 = seg.y + seg.slope * seg.length;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    // Draw wheels
    ctx.fillStyle = '#f66';
    ctx.beginPath();
    ctx.arc(wheelA.x, wheelA.y, wheelRadius, 0, Math.PI * 2);
    ctx.arc(wheelB.x, wheelB.y, wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    // Draw frame
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(wheelA.x, wheelA.y);
    ctx.lineTo(wheelB.x, wheelB.y);
    ctx.stroke();
    // Draw rider as a small upright bar on top of the midpoint
    const midX = (wheelA.x + wheelB.x) / 2;
    const midY = (wheelA.y + wheelB.y) / 2;
    // Height of rider relative to frame orientation
    const dx = wheelB.x - wheelA.x;
    const dy = wheelB.y - wheelA.y;
    const angle = Math.atan2(dy, dx) - Math.PI / 2;
    const riderHeight = 30;
    const headRadius  = 6;
    // Bottom of rider
    const bx = midX + Math.cos(angle) * (wheelDistance * 0.2);
    const by = midY + Math.sin(angle) * (wheelDistance * 0.2);
    const tx = bx + Math.cos(angle) * riderHeight;
    const ty = by + Math.sin(angle) * riderHeight;
    // Body
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    // Head
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(tx, ty, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Start the animation loop
  requestAnimationFrame(update);
})();