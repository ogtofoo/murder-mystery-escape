// Day/night cycle and weather: sky colours, sun and moon, stars, rain, snow,
// lightning and the rare showpiece events.

import * as THREE from 'three';

export const DAY_LENGTH = 480;      // seconds for a full day/night cycle

// Sky and light colours at each point of the day, blended between keys.
const KEYS = [
  { t: 0.00, sky: 0x101838, fog: 0x101838, sun: 0x5570b0, sunI: 0.42, hemi: 0.62, hemiSky: 0x4a5f9e, hemiGround: 0x2a3550 },
  { t: 0.20, sky: 0xf2905e, fog: 0xf0a878, sun: 0xffb066, sunI: 1.1,  hemi: 0.7,  hemiSky: 0xffd6b0, hemiGround: 0x5a4a3a },
  { t: 0.30, sky: 0x8fd0f2, fog: 0x8fd0f2, sun: 0xfff3d6, sunI: 2.1,  hemi: 1.0,  hemiSky: 0xcfe9ff, hemiGround: 0x4b7a3a },
  { t: 0.70, sky: 0x8fd0f2, fog: 0x8fd0f2, sun: 0xfff3d6, sunI: 2.1,  hemi: 1.0,  hemiSky: 0xcfe9ff, hemiGround: 0x4b7a3a },
  { t: 0.80, sky: 0xff8a5c, fog: 0xffa478, sun: 0xff9a4d, sunI: 1.0,  hemi: 0.66, hemiSky: 0xffc9a0, hemiGround: 0x4a3a2a },
  { t: 0.88, sky: 0x252f60, fog: 0x252f60, sun: 0x4a5f9e, sunI: 0.5,  hemi: 0.66, hemiSky: 0x46589a, hemiGround: 0x27314a },
  { t: 1.00, sky: 0x101838, fog: 0x101838, sun: 0x5570b0, sunI: 0.42, hemi: 0.62, hemiSky: 0x4a5f9e, hemiGround: 0x2a3550 },
];

function blend(t) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i].t && t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return {
    sky: new THREE.Color(a.sky).lerp(new THREE.Color(b.sky), k),
    fog: new THREE.Color(a.fog).lerp(new THREE.Color(b.fog), k),
    sun: new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), k),
    sunI: a.sunI + (b.sunI - a.sunI) * k,
    hemi: a.hemi + (b.hemi - a.hemi) * k,
    hemiSky: new THREE.Color(a.hemiSky).lerp(new THREE.Color(b.hemiSky), k),
    hemiGround: new THREE.Color(a.hemiGround).lerp(new THREE.Color(b.hemiGround), k),
  };
}

/** 0 = midnight, 0.5 = noon. Driven by the wall clock so it keeps ticking. */
export function dayPhase(now = Date.now()) {
  return ((now / 1000) % DAY_LENGTH) / DAY_LENGTH;
}

export function isNight(phase = dayPhase()) {
  return phase < 0.22 || phase > 0.84;
}

/** A readable clock face for the HUD, e.g. "06:42". */
export function clockLabel(phase = dayPhase()) {
  const mins = Math.floor(phase * 24 * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

export class Sky {
  constructor(scene, sun, hemi) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.weather = 'clear';
    this.flash = 0;
    this.nextBolt = 3;

    // Stars, only visible after dark.
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3().setFromSphericalCoords(
        150, Math.acos(Math.random() * 0.9), Math.random() * Math.PI * 2);
      pts.push(v.x, Math.abs(v.y), v.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0,
    }));
    scene.add(this.stars);

    // Sun and moon discs riding the same arc.
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff2c4 }));
    this.moonDisc = new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xf2f5ff }));
    this.moonGlow = new THREE.PointLight(0xbcd0ff, 0, 90);
    scene.add(this.sunDisc, this.moonDisc, this.moonGlow);

    // Precipitation: one buffer reused for rain and snow.
    this.dropCount = 1400;
    const dropGeo = new THREE.BufferGeometry();
    this.dropPos = new Float32Array(this.dropCount * 3);
    for (let i = 0; i < this.dropCount; i++) this.resetDrop(i, true);
    dropGeo.setAttribute('position', new THREE.BufferAttribute(this.dropPos, 3));
    this.drops = new THREE.Points(dropGeo, new THREE.PointsMaterial({
      color: 0xbfe4ff, size: 0.16, transparent: true, opacity: 0, depthWrite: false,
    }));
    scene.add(this.drops);

    // Lightning: a bright flash light parked above the garden.
    this.bolt = new THREE.PointLight(0xdff0ff, 0, 120);
    this.bolt.position.set(0, 40, 0);
    scene.add(this.bolt);

    // A rainbow arc for the showpiece weather.
    this.rainbow = new THREE.Mesh(
      new THREE.TorusGeometry(46, 1.7, 6, 40, Math.PI),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    paintRainbow(this.rainbow.geometry);
    this.rainbow.position.set(0, -2, -30);
    scene.add(this.rainbow);

    // Meteors streak across the night sky.
    this.meteors = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.4, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffe0a3, transparent: true, opacity: 0 }));
      m.userData.timer = Math.random() * 6;
      this.meteors.push(m);
      scene.add(m);
    }
  }

  resetDrop(i, spread = false) {
    this.dropPos[i * 3 + 0] = (Math.random() - 0.5) * 70;
    this.dropPos[i * 3 + 1] = spread ? Math.random() * 30 : 22 + Math.random() * 8;
    this.dropPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }

  /** @param spec the weather definition, for its moon and sky tints */
  setWeather(id, spec = null) { this.weather = id; this.spec = spec; }

  /** @param player world position, so precipitation follows you around */
  update(dt, phase, player) {
    const c = blend(phase);
    const spec = this.spec;
    const storm = this.weather === 'storm';
    const wet = storm || this.weather === 'rain';
    const snow = this.weather === 'frost';

    // Weather dims and greys the sky on top of the time of day.
    const gloom = storm ? 0.55 : wet ? 0.38 : snow ? 0.25 : 0;
    let skyCol = c.sky.clone().lerp(new THREE.Color(storm ? 0x2b3038 : 0x9aa7b4), gloom);
    if (spec?.sky) skyCol = skyCol.lerp(new THREE.Color(spec.sky), 0.75);   // aurora, blood moon
    this.scene.background = skyCol;
    this.scene.fog.color.copy(c.fog.clone().lerp(skyCol, 0.6));
    this.scene.fog.near = wet || snow ? 20 : 40;
    this.scene.fog.far = wet || snow ? 90 : 130;

    this.sun.color.copy(c.sun);
    this.sun.intensity = c.sunI * (1 - gloom * 0.7) + this.flash * 3;
    this.hemi.intensity = c.hemi * (1 - gloom * 0.4) + this.flash;
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);

    // Sun and moon ride opposite ends of the same arc.
    const a = (phase - 0.25) * Math.PI * 2;
    const R = 110;
    this.sun.position.set(Math.cos(a) * 40, Math.sin(a) * 50 + 6, 22);
    this.sunDisc.position.set(Math.cos(a) * R, Math.sin(a) * R, 40);
    this.moonDisc.position.set(-Math.cos(a) * R, -Math.sin(a) * R, 40);
    // A harvest, mega or blood moon hangs bigger and takes on its own colour.
    const moonTint = spec?.moon;
    this.moonDisc.material.color.setHex(moonTint || 0xf2f5ff);
    this.moonDisc.scale.setScalar(moonTint ? 2.1 : 1);
    if (moonTint) this.moonGlow.color.setHex(moonTint);
    else this.moonGlow.color.setHex(0xbcd0ff);
    this.sunDisc.visible = this.sunDisc.position.y > -10;
    this.moonDisc.visible = this.moonDisc.position.y > -10;

    const night = isNight(phase) ? 1 : 0;
    this.moonGlow.position.copy(this.moonDisc.position).multiplyScalar(0.35).setY(30);
    this.moonGlow.intensity = night * (moonTint ? 420 : 220) * (1 - gloom * 0.6);
    this.stars.material.opacity += ((night ? 0.9 : 0) - this.stars.material.opacity) * Math.min(1, dt * 1.5);
    this.stars.position.set(player.x, 0, player.z);
    this.stars.rotation.y += dt * 0.006;

    // Precipitation.
    const want = storm ? 0.85 : wet ? 0.7 : snow ? 0.75 : 0;
    const m = this.drops.material;
    m.opacity += (want - m.opacity) * Math.min(1, dt * 2);
    this.drops.visible = m.opacity > 0.02;
    if (this.drops.visible) {
      m.color.setHex(snow ? 0xffffff : 0xbfe4ff);
      m.size = snow ? 0.3 : 0.16;
      const fall = snow ? 3.5 : 34;
      const drift = snow ? 1.2 : 0;
      for (let i = 0; i < this.dropCount; i++) {
        this.dropPos[i * 3 + 1] -= fall * dt;
        if (drift) this.dropPos[i * 3] += Math.sin(performance.now() * 0.001 + i) * drift * dt;
        if (this.dropPos[i * 3 + 1] < 0) this.resetDrop(i);
      }
      this.drops.geometry.attributes.position.needsUpdate = true;
      this.drops.position.set(player.x, 0, player.z);
    }

    // Lightning.
    this.flash = Math.max(0, this.flash - dt * 4);
    if (storm) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 3 + Math.random() * 7;
        this.flash = 1;
        this.struck = true;
      }
    }
    this.bolt.intensity = this.flash * 900;

    // Rainbow arc and meteors.
    const rw = this.weather === 'rainbow' ? 0.9 : 0;
    this.rainbow.material.opacity += (rw - this.rainbow.material.opacity) * Math.min(1, dt * 1.5);
    this.rainbow.visible = this.rainbow.material.opacity > 0.02;

    // Aurora curtains.
    if (!this.curtains) {
      this.curtains = [];
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 26, 1, 1),
          new THREE.MeshBasicMaterial({ color: [0x69f0ae, 0x40c4ff, 0xb388ff][i % 3],
            transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
        m.position.set((i - 2) * 26, 34, -70 - i * 8);
        m.rotation.z = (i - 2) * 0.12;
        this.curtains.push(m);
        this.scene.add(m);
      }
    }
    const auroraOn = this.weather === 'aurora' ? 0.34 : 0;
    this.curtains.forEach((m, i) => {
      m.material.opacity += (auroraOn - m.material.opacity) * Math.min(1, dt * 1.2);
      m.visible = m.material.opacity > 0.01;
      if (m.visible) m.position.y = 34 + Math.sin(performance.now() * 0.0004 + i) * 5;
    });

    const meteorOn = this.weather === 'meteor';
    for (const mt of this.meteors) {
      if (!meteorOn) { mt.material.opacity = 0; mt.visible = false; continue; }
      mt.visible = true;
      mt.userData.timer -= dt;
      if (mt.userData.timer <= 0) {
        mt.userData.timer = 1 + Math.random() * 5;
        mt.position.set((Math.random() - 0.5) * 160, 60 + Math.random() * 30, (Math.random() - 0.5) * 160);
        mt.userData.vel = new THREE.Vector3(-14 - Math.random() * 10, -22, -6);
        mt.material.opacity = 1;
        mt.lookAt(mt.position.clone().add(mt.userData.vel));
        mt.rotateX(Math.PI / 2);
      }
      if (mt.userData.vel) {
        mt.position.addScaledVector(mt.userData.vel, dt);
        mt.material.opacity = Math.max(0, mt.material.opacity - dt * 0.5);
      }
    }
  }

  /** True once per lightning strike, for gameplay to react to. */
  takeStrike() {
    if (!this.struck) return false;
    this.struck = false;
    return true;
  }
}

function paintRainbow(geo) {
  const bands = [0xff4d4d, 0xffa74d, 0xffe94d, 0x5ddb5d, 0x4db8ff, 0x7a5cff, 0xc45cff];
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const c = new THREE.Color(bands[Math.floor((i / pos.count) * bands.length) % bands.length]);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}
