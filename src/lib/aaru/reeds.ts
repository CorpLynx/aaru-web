/*
  AARU: sign-in scene, "Reeds gathering".

  Reed stems surface from black night water lit only by the moon, topple flat
  with a ripple, then drift together and line up into the word AARU.

  Design source: CorpLynx/aaru design/login/index.html. One WebGL2 fragment
  shader draws the water and the reeds; the CPU updates each reed's position,
  tilt and age once a frame and uploads them as a 3-row float texture.
*/

export type ReedsOptions = {
	/** Seconds for the reeds to gather into the word. */
	formSeconds?: number;
	/** Start with the word already formed (prefers-reduced-motion). */
	reduceMotion?: boolean;
};

export type ReedsHandle = {
	/** Start the gathering again from the beginning. */
	replay: () => void;
	/** Stop the animation loop and release the GL context. */
	destroy: () => void;
};

type Reed = {
	tx: number;
	tz: number;
	ta: number;
	hl: number;
	sx: number;
	sz: number;
	sa: number;
	letter: number;
	stray: boolean;
	r1: number;
	r2: number;
	r3: number;
	vx: number;
	vz: number;
	w: number;
	seed: number;
	px?: number;
	pz?: number;
	svx?: number;
	svz?: number;
};

const FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform vec2 uRes;
uniform float uTime;
uniform float uCam;
uniform int uN;
uniform sampler2D uData;
uniform vec4 uTouch[8];   // xz, birth time, strength
out vec4 fragColor;

const vec3 L = vec3(-0.500, 0.740, -0.450);
const vec3 MOON = vec3(0.70, 0.79, 1.00);

float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1.,0.,0.)), f.x),
                 mix(hash(i+vec3(0.,1.,0.)), hash(i+vec3(1.,1.,0.)), f.x), f.y),
             mix(mix(hash(i+vec3(0.,0.,1.)), hash(i+vec3(1.,0.,1.)), f.x),
                 mix(hash(i+vec3(0.,1.,1.)), hash(i+vec3(1.,1.,1.)), f.x), f.y), f.z);
}

float baseWaves(vec2 p, float t){
  float h = 0.010*sin(dot(p, vec2(0.8,0.6))*2.1 + t*0.9)
          + 0.007*sin(dot(p, vec2(-0.6,0.8))*3.3 + t*1.3)
          + 0.004*sin(dot(p, vec2(0.3,-0.95))*5.7 + t*1.9);
  h += (noise(vec3(p*3.0 + vec2(t*0.05, t*0.03), t*0.25)) - 0.5)*0.030;
  h += (noise(vec3(p*7.0 + vec2(5.0 - t*0.08, t*0.06), t*0.45)) - 0.5)*0.014;
  h += (noise(vec3(p*16.0 + vec2(t*0.12, 9.0 - t*0.1), t*0.8)) - 0.5)*0.0075;
  h += (noise(vec3(p*36.0 + vec2(2.0 - t*0.2, t*0.15), t*1.4)) - 0.5)*0.0036;
  return h;
}

float segDist(vec2 q, vec2 dir, float hl){
  float al = dot(q, dir);
  float ac = dot(q, vec2(-dir.y, dir.x));
  float da = max(abs(al) - hl, 0.0);
  return sqrt(da*da + ac*ac);
}

vec2 bubblePos(vec2 dir, float hl, float seed, float fk){
  float hb1 = fract(seed*91.7 + fk*0.37), hb2 = fract(seed*53.3 + fk*0.71);
  return dir*(hl - hb2*hl*1.4) + vec2(-dir.y, dir.x)*(hb1 - 0.5)*0.03;
}
float bubbleAge(float age, float seed, float fk){
  return age + 0.9 - fk*0.35 - fract(seed*91.7 + fk*0.37)*0.2;
}

// A: centre.xz, angle, projected half-length   B: tip depth (neg = above), age since tip broke surface, glide speed, seed
// C: tan(pitch), age since it fell flat (-1 = not yet), true half-length, age since it docked into its letter (-1 = not yet)
// D (row 3, passed as vel): smoothed glide velocity.xz
// Every term below fades in and out smoothly and is ~0 at the cull radius used in main(),
// so nothing pops or leaves a seam on the water.
float reedRip(vec2 q, vec2 dir, vec4 A, vec4 B, vec4 C, vec2 vel, float rad){
  float h = 0.0;
  float d = segDist(q, dir, A.w);
  float dt = length(q - dir*A.w);
  float age = B.y, la = C.y;

  // the surface swells over the rising tip, then relaxes once it is through
  float bump = age < 0.0 ? 1.0 - clamp(B.x/0.08, 0.0, 1.0) : exp(-age*9.0);
  h += 0.010*bump*exp(-dt*30.0);

  // meniscus: around the tip while the stem stands, along the whole stem once it lies flat
  float flatT = smoothstep(0.0, 0.25, la);
  h += 0.0035*smoothstep(0.0, 0.2, age)*(1.0 - flatT)*exp(-max(dt - rad, 0.0)/0.008);
  h += 0.0025*flatT*exp(-max(d - rad, 0.0)/0.007);

  // ring from the tip breaking the surface
  if (age > 0.0 && age < 4.0){
    float x = dt - age*0.25;
    h += 0.005*sin(x*75.0)*exp(-x*x*450.0)*exp(-age*0.9)*smoothstep(0.0, 0.18, age)*smoothstep(4.0, 3.0, age);
  }
  // the slap as it falls flat: a ring off the whole stem and a brief trough under it
  if (la > 0.0 && la < 4.0){
    float x = d - la*0.3;
    h += 0.008*sin(x*65.0)*exp(-x*x*350.0)*exp(-la*0.9)*smoothstep(0.0, 0.12, la)*smoothstep(4.0, 3.0, la);
    h -= 0.006*smoothstep(0.0, 0.08, la)*exp(-la*6.0)*exp(-d*30.0);
  }

  // Wake of a gliding stem, steady in the stem's own frame: a low bow wave pushed
  // ahead of it and short ripples trailing behind.
  float sp = length(vel);
  if (sp > 0.002){
    vec2 vh = vel/sp;
    float s = min(sp, 0.6);
    float al = dot(q, vh);
    float ext = abs(dot(dir, vh))*A.w;   // how far the stem reaches along its heading
    h += s*0.010*smoothstep(-0.03, 0.06, al - ext)*exp(-d*22.0);
    float back = al + ext;
    h += s*0.007*sin(back*46.0)*smoothstep(0.02, -0.08, back)*exp(back*3.0)*exp(-d*d*70.0);
  }

  // a faint ring as the stem nudges into its place in the word
  if (C.w > 0.0 && C.w < 3.0){
    float x = d - 0.02 - C.w*0.2;
    h += 0.0024*sin(x*52.0)*exp(-x*x*300.0)*smoothstep(0.0, 0.35, C.w)*smoothstep(3.0, 1.8, C.w);
  }

  for (int k = 0; k < 3; k++){
    float fk = float(k);
    float ba = bubbleAge(age, B.w, fk);
    if (ba > 0.7 && ba < 2.2){
      float x = length(q - bubblePos(dir, A.w, B.w, fk)) - (ba - 0.7)*0.15;
      h += 0.0015*sin(x*120.0)*exp(-x*x*3000.0)*exp(-(ba - 0.7)*2.0)*smoothstep(0.7, 0.85, ba);
    }
  }
  return h;
}

// rings left by the pointer
float touchRip(vec2 p){
  float h = 0.0;
  for (int k = 0; k < 8; k++){
    vec4 T = uTouch[k];
    float age = uTime - T.z;
    if (T.w <= 0.0 || age < 0.0 || age > 3.5) continue;
    float x = length(p - T.xy) - age*0.26;
    h += T.w*0.006*sin(x*60.0)*exp(-x*x*260.0)*exp(-age*1.4);
  }
  return h;
}

// a sparse field of stars, seen only by reflection
vec3 stars(vec3 r){
  vec2 s = r.xz/max(r.y, 0.2)*26.0;
  vec2 c = floor(s);
  float hs = hash(vec3(c, 7.0));
  if (hs < 0.88) return vec3(0.0);
  vec2 o = (vec2(hash(vec3(c, 1.0)), hash(vec3(c, 2.0))) - 0.5)*0.7;
  float d = length(fract(s) - 0.5 - o);
  float mag = pow((hs - 0.88)/0.12, 3.0);
  float tw = 0.7 + 0.3*sin(uTime*(0.8 + hs*2.5) + hs*40.0);
  vec3 tint = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.9, 0.78), hash(vec3(c, 3.0)));
  return tint*mag*tw*smoothstep(0.07, 0.0, d);
}

vec3 moonRad(vec3 r){
  float d = max(dot(r, L), 0.0);
  return MOON*(pow(d, 3000.0)*140.0 + pow(d, 400.0)*8.0 + pow(d, 60.0)*0.5);
}

// Moonlight on the water. Graded lobes so a ripple shades from black through
// silver to white instead of flashing, and the sharpest lobe widens where the
// surface turns faster than a pixel can resolve (w), which stops the sparkle crawling.
vec3 moonWater(vec3 r, float w){
  float d = max(dot(r, L), 0.0);
  float sharp = mix(3000.0, 450.0, w);
  return MOON*(pow(d, sharp)*140.0*(sharp/3000.0) + pow(d, 400.0)*8.0 + pow(d, 110.0)*1.6 + pow(d, 60.0)*0.5 + pow(d, 18.0)*0.12);
}

void main(){
  vec2 uv0 = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  vec2 uv = uv0; uv.y -= 0.2;
  float H = uCam;
  vec3 ro = vec3(sin(uTime*0.04)*0.03, H, cos(uTime*0.05)*0.03);
  vec3 rd = normalize(vec3(uv.x, -1.6, -uv.y));
  float tW = ro.y/(-rd.y);
  vec2 p = (ro + rd*tW).xz;
  float px = tW/(1.6*uRes.y);
  float e = 0.0022 + 0.0003*tW;
  float t = uTime;
  float h0 = baseWaves(p, t);
  float hx = baseWaves(p + vec2(e, 0.0), t);
  float hz = baseWaves(p + vec2(0.0, e), t);
  h0 += touchRip(p);
  hx += touchRip(p + vec2(e, 0.0));
  hz += touchRip(p + vec2(0.0, e));
  vec3 nb = normalize(vec3(h0 - hx, e, h0 - hz));

  float bestTop = -1e3; float bCov = 0.0;
  float bAlong = 0.0, bS = 0.0, bHl = 1.0, bAng = 0.0, bY = 0.0, bSeed = 0.0, bTan = 0.0, bAge = 0.0;
  vec3 bub = vec3(0.0); float bubCov = 0.0;
  for (int i = 0; i < 128; i++){
    if (i >= uN) break;
    vec4 A = texelFetch(uData, ivec2(i, 0), 0);
    vec4 B = texelFetch(uData, ivec2(i, 1), 0);
    vec4 C = texelFetch(uData, ivec2(i, 2), 0);
    vec2 vel = texelFetch(uData, ivec2(i, 3), 0).xy;
    vec2 dc = p - A.xy;
    float r1 = (B.y > -1.0 && B.y < 4.0) ? max(B.y, 0.0)*0.25 + 0.1 : 0.0;
    float r2 = (C.y >= 0.0 && C.y < 4.0) ? C.y*0.3 + 0.1 : 0.0;
    float r3 = (C.w >= 0.0 && C.w < 3.0) ? C.w*0.22 + 0.1 : 0.0;
    float rw = dot(vel, vel) > 4e-6 ? 0.3 : 0.0;
    float cullR = A.w + 0.14 + max(max(r1, r2), max(r3, rw));
    if (dot(dc, dc) > cullR*cullR) continue;
    vec2 dir = vec2(cos(A.z), sin(A.z));
    vec2 perp = vec2(-dir.y, dir.x);
    float R = 0.02*(0.85 + 0.3*fract(B.w*13.7));
    h0 += reedRip(dc, dir, A, B, C, vel, R);
    hx += reedRip(dc + vec2(e, 0.0), dir, A, B, C, vel, R);
    hz += reedRip(dc + vec2(0.0, e), dir, A, B, C, vel, R);

    // air escaping the hollow stem just before it surfaces
    for (int k = 0; k < 3; k++){
      float fk = float(k);
      float ba = bubbleAge(B.y, B.w, fk);
      if (ba > 0.0 && ba < 0.7){
        float br = 0.0058*(0.6 + 0.4*fract(B.w*53.3 + fk*0.71))*min(ba*8.0, 1.0);
        vec2 dv = (dc - bubblePos(dir, A.w, B.w, fk))/br;
        float s2 = length(dv);
        if (s2 < 1.0 + px/br){
          float cv = smoothstep(1.0 + px/br, 1.0 - px/br, s2);
          vec3 bn = normalize(vec3(dv.x, sqrt(max(1.0 - s2*s2, 0.0)), dv.y));
          bub += (moonRad(reflect(rd, bn))*0.25 + MOON*pow(min(s2, 1.0), 8.0)*0.05)*cv;
          bubCov = max(bubCov, cv);
        }
      }
    }

    float al = dot(dc, dir);
    if (abs(al) < A.w + 0.01){
      float y = -B.x - (A.w - al)*C.x;
      if (y > -0.12){
        float sub = max(-y, 0.0);
        vec2 dq = dc + nb.xz*sub*0.9;
        al = dot(dq, dir);
        float ac = dot(dq, perp);
        if (abs(al) < A.w){
          float tipT = smoothstep(A.w, A.w - 0.05, abs(al));
          // rounded ends, and a taper from the thick base to the tip
          float rad = R*(0.5 + 0.5*tipT)*(1.0 - 0.3*(al/A.w*0.5 + 0.5));
          float cov = smoothstep(rad + px*0.5, rad - px*0.5, abs(ac))*smoothstep(A.w, A.w - px, abs(al));
          if (cov > 0.0){
            float top = y + B.w*0.004 + sqrt(max(rad*rad - ac*ac, 0.0));
            if (top > bestTop){
              bestTop = top; bCov = cov; bAlong = al; bS = clamp(ac/rad, -1.0, 1.0);
              bHl = A.w; bAng = A.z; bY = y; bSeed = B.w; bTan = C.x; bAge = B.y;
            }
          }
        }
      }
    }
  }

  // pure black water: only the moon, by reflection
  vec3 n = normalize(vec3(h0 - hx, e, h0 - hz));
  float fres = 0.02 + 0.98*pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  float nw = clamp(length(fwidth(n))*14.0, 0.0, 1.0);
  vec3 col = moonWater(reflect(rd, n), nw)*fres;
  // stars use a calmer normal so they wobble on the swell instead of breaking into noise
  col += stars(reflect(rd, normalize(vec3(n.x*0.12, 1.0, n.z*0.12))))*0.42;

  if (bCov > 0.0){
    vec2 dir = vec2(cos(bAng), sin(bAng));
    vec2 perp = vec2(-dir.y, dir.x);
    float s = bS;
    vec3 nr = normalize(vec3(perp.x*s, sqrt(max(1.0 - s*s, 0.0)), perp.y*s));
    nr = normalize(nr - vec3(dir.x, 0.0, dir.y)*bTan*nr.y);
    float u = bAlong;
    vec3 alb = mix(vec3(0.105, 0.09, 0.055), vec3(0.065, 0.075, 0.042), fract(bSeed*7.13));
    alb *= 0.75 + 0.45*noise(vec3(u*3.0, bSeed*50.0, 0.0));
    float fib = noise(vec3(u*6.0, s*16.0, bSeed*30.0));
    alb *= 0.82 + 0.25*fib;
    nr = normalize(nr + vec3(perp.x, 0.0, perp.y)*(fib - 0.5)*0.15);
    float fu = fract(u*4.2 + bSeed*3.0);
    float node = 1.0 - smoothstep(0.0, 0.035, min(fu, 1.0 - fu));
    alb *= 1.0 - 0.45*node;
    float endc = smoothstep(bHl - 0.012, bHl, abs(u));
    alb *= 1.0 - 0.5*endc;
    // green at the base, dried straw toward the tip
    alb = mix(alb, alb*vec3(1.35, 1.15, 0.72), smoothstep(-bHl, bHl, u)*0.55);
    float wf = exp(-max(bAge, 0.0)/6.0);
    alb *= 1.0 - 0.3*wf;   // darker while still wet
    float dif = max(dot(nr, L), 0.0);

    // Stems lying on top of this one: a moon shadow cast across it, and a dark crease where they touch.
    float occ = 0.0;
    vec2 ls = normalize(L.xz)*0.02;
    for (int j = 0; j < 128; j++){
      if (j >= uN) break;
      vec4 B2 = texelFetch(uData, ivec2(j, 1), 0);
      if (B2.w <= bSeed + 1e-4 || B2.y < 0.0) continue;
      vec4 A2 = texelFetch(uData, ivec2(j, 0), 0);
      vec2 dc2 = p - A2.xy;
      float cr = A2.w + 0.08;
      if (dot(dc2, dc2) > cr*cr) continue;
      vec2 d2 = vec2(cos(A2.z), sin(A2.z));
      float R2 = 0.02*(0.85 + 0.3*fract(B2.w*13.7));
      occ = max(occ, 0.75*smoothstep(R2*1.6, R2*0.5, segDist(dc2 + ls, d2, A2.w)));
      occ = max(occ, 0.35*smoothstep(R2*2.4, R2, segDist(dc2, d2, A2.w)));
    }
    float lit = 1.0 - occ;
    vec3 rc = alb*(MOON*dif*1.15*lit + vec3(0.003, 0.004, 0.006));
    vec3 rr = reflect(rd, nr);
    float sd = max(dot(rr, L), 0.0);
    rc += MOON*(pow(sd, 90.0)*0.18 + pow(sd, 700.0)*1.6*(1.0 + wf))*(1.0 - 0.6*node)*lit;
    // beads of water on a freshly surfaced stem
    float bead = smoothstep(0.8, 0.9, noise(vec3(u*70.0, s*5.0, bSeed*40.0)))*wf;
    rc += MOON*bead*0.12*(0.3 + pow(sd, 20.0));
    float sub = max(-bY, 0.0);
    if (sub > 0.0) rc = rc*exp(-sub*40.0) + col;
    else rc = mix(rc, col, smoothstep(0.004, 0.0, bY)*0.5);
    col = mix(col, rc, bCov);
  }
  col = mix(col, bub, bubCov*0.85);

  col *= 1.25;
  col = (col*(2.51*col + 0.03))/(col*(2.43*col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));
  col *= 1.0 - 0.3*dot(uv0, uv0);
  col += (hash(vec3(gl_FragCoord.xy, fract(uTime)*91.0)) - 0.5)*0.006;
  fragColor = vec4(max(col, 0.0), 1.0);
}
`;

const VERT = '#version 300 es\nin vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }';

// Stroke segments per glyph: [x0, y0, x1, y1] in letter space (y up, 0..1).
const A = [
	[-0.36, 0.0, -0.05, 1.0],
	[0.36, 0.0, 0.05, 1.0],
	[-0.27, 0.36, 0.27, 0.36]
];
const R = [
	[-0.28, 0.0, -0.28, 1.0],
	[-0.4, 0.93, 0.24, 0.93],
	[0.29, 0.95, 0.29, 0.48],
	[-0.4, 0.52, 0.3, 0.52],
	[-0.02, 0.5, 0.38, 0.0]
];
const U = [
	[-0.29, 0.1, -0.29, 1.0],
	[0.29, 0.1, 0.29, 1.0],
	[-0.4, 0.07, 0.4, 0.07]
];

function buildReeds(): Reed[] {
	let seed = 20261108;
	const rnd = () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const startPos = (stray: boolean): [number, number] => {
		for (let k = 0; k < 40; k++) {
			const x = -2.5 + rnd() * 5.0;
			const z = -1.0 + rnd() * 2.7;
			const inside = Math.abs(x) < 2.0 && z > -0.65 && z < 0.75;
			if (!stray || !inside) return [x, z];
		}
		return [2.3, 1.2];
	};

	const reeds: Reed[] = [];
	[A, A, R, U].forEach((glyph, li) => {
		const cx = -1.47 + 0.98 * li;
		for (const s of glyph) {
			const x0 = cx + s[0];
			const z0 = 0.5 - s[1];
			const x1 = cx + s[2];
			const z1 = 0.5 - s[3];
			const dx = x1 - x0;
			const dz = z1 - z0;
			const len = Math.sqrt(dx * dx + dz * dz);
			const ux = dx / len;
			const uz = dz / len;
			const px = -uz;
			const pz = ux;
			for (let k = 0; k < 4; k++) {
				const o = (k - 1.5) * 0.042 + (rnd() - 0.5) * 0.008;
				const al = (rnd() - 0.5) * 0.06;
				const sp = startPos(false);
				reeds.push({
					tx: (x0 + x1) / 2 + px * o + ux * al,
					tz: (z0 + z1) / 2 + pz * o + uz * al,
					ta: Math.atan2(uz, ux),
					hl: len / 2 + 0.05 + (rnd() - 0.5) * 0.06,
					sx: sp[0],
					sz: sp[1],
					sa: rnd() * Math.PI,
					letter: li,
					stray: false,
					r1: rnd(),
					r2: rnd(),
					r3: rnd(),
					vx: (rnd() - 0.5) * 0.06,
					vz: (rnd() - 0.5) * 0.06,
					w: (rnd() - 0.5) * 0.16,
					seed: rnd()
				});
			}
		}
	});
	// A few loose reeds that never join the word.
	for (let j = 0; j < 14; j++) {
		const sp = startPos(true);
		const ang = Math.atan2(sp[1] - 0.2, sp[0]);
		reeds.push({
			tx: 0,
			tz: 0,
			ta: 0,
			hl: 0.16 + rnd() * 0.22,
			sx: sp[0],
			sz: sp[1],
			sa: rnd() * Math.PI,
			letter: 0,
			stray: true,
			r1: rnd(),
			r2: rnd(),
			r3: rnd(),
			vx: Math.cos(ang) * 0.015,
			vz: Math.sin(ang) * 0.015,
			w: (rnd() - 0.5) * 0.1,
			seed: rnd()
		});
	}
	return reeds;
}

/** Height of the top-down camera above the water: pulls back on narrow screens so the word fits. */
const camHeight = (aspect: number) => Math.max(4.2, 6.5 / aspect);

const smooth = (x: number) => {
	x = Math.min(1, Math.max(0, x));
	return x * x * x * (x * (x * 6 - 15) + 10);
};
const wrapPi = (a: number) => {
	a = (a + Math.PI / 2) % Math.PI;
	if (a < 0) a += Math.PI;
	return a - Math.PI / 2;
};

/** Returns null when WebGL2 or the shader is unavailable; the page then keeps its flat background. */
export function startReeds(canvas: HTMLCanvasElement, opts: ReedsOptions = {}): ReedsHandle | null {
	const gl = canvas.getContext('webgl2', {
		antialias: false,
		alpha: false,
		depth: false,
		stencil: false,
		powerPreference: 'high-performance'
	});
	if (!gl) return null;

	const compile = (type: number, src: string) => {
		const s = gl.createShader(type);
		if (!s) return null;
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
			console.warn('Aaru reeds shader:', gl.getShaderInfoLog(s));
			return null;
		}
		return s;
	};
	const vs = compile(gl.VERTEX_SHADER, VERT);
	const fs = compile(gl.FRAGMENT_SHADER, FRAG);
	const prog = gl.createProgram();
	if (!vs || !fs || !prog) return null;
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		console.warn('Aaru reeds link:', gl.getProgramInfoLog(prog));
		return null;
	}
	gl.useProgram(prog);

	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const aP = gl.getAttribLocation(prog, 'aP');
	gl.enableVertexAttribArray(aP);
	gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
	const uRes = gl.getUniformLocation(prog, 'uRes');
	const uTime = gl.getUniformLocation(prog, 'uTime');
	const uCam = gl.getUniformLocation(prog, 'uCam');
	const uTouch = gl.getUniformLocation(prog, 'uTouch');

	const reeds = buildReeds();
	const N = reeds.length;
	const data = new Float32Array(N * 4 * 4);
	const tex = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, 4, 0, gl.RGBA, gl.FLOAT, data);
	gl.uniform1i(gl.getUniformLocation(prog, 'uData'), 0);
	gl.uniform1i(gl.getUniformLocation(prog, 'uN'), N);

	const D = Math.min(40, Math.max(6, opts.formSeconds ?? 18));
	const skip = opts.reduceMotion ? 120 : 0;

	// Render below device resolution on large screens, and adapt to hold the frame rate.
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const area0 = Math.max(1, canvas.clientWidth * dpr) * Math.max(1, canvas.clientHeight * dpr);
	let scale = Math.max(0.5, Math.min(1, Math.sqrt(2400000 / area0)));
	const resize = () => {
		const w = Math.max(1, Math.round(canvas.clientWidth * dpr * scale));
		const h = Math.max(1, Math.round(canvas.clientHeight * dpr * scale));
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		gl.viewport(0, 0, w, h);
	};
	resize();
	const ro = new ResizeObserver(resize);
	ro.observe(canvas);

	let t0 = performance.now();

	// The pointer leaves rings on the water. Screen position maps to the water
	// plane the same way the shader's top-down camera does.
	const touches = new Float32Array(8 * 4);
	let touchIdx = 0;
	let lastTX = 1e9;
	let lastTZ = 1e9;
	const addTouch = (ev: PointerEvent, press: boolean) => {
		const rect = canvas.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		const ux = (ev.clientX - rect.left - rect.width / 2) / rect.height;
		const uy = (rect.height / 2 - (ev.clientY - rect.top)) / rect.height - 0.2;
		const k = camHeight(rect.width / rect.height) / 1.6;
		const wx = ux * k;
		const wz = -uy * k;
		const dist = Math.sqrt((wx - lastTX) ** 2 + (wz - lastTZ) ** 2);
		if (!press && dist < 0.09) return;
		lastTX = wx;
		lastTZ = wz;
		touches.set(
			[wx, wz, (performance.now() - t0) / 1000 + skip, press ? 1 : Math.min(0.8, 0.3 + dist * 2)],
			touchIdx * 4
		);
		touchIdx = (touchIdx + 1) % 8;
	};
	const onMove = (ev: PointerEvent) => addTouch(ev, false);
	const onDown = (ev: PointerEvent) => addTouch(ev, true);
	if (!opts.reduceMotion) {
		window.addEventListener('pointermove', onMove, { passive: true });
		window.addEventListener('pointerdown', onDown, { passive: true });
	}
	let last = t0;
	let acc = 0;
	let frames = 0;
	let lastT = -1;
	let raf = 0;
	let alive = true;

	const loop = (now: number) => {
		if (!alive) return;
		raf = requestAnimationFrame(loop);
		if (document.hidden) return;

		const dtMs = now - last;
		last = now;
		if (dtMs < 100) {
			acc += dtMs;
			frames++;
		}
		if (frames >= 24) {
			const avg = acc / frames;
			if (avg > 22 && scale > 0.5) {
				scale = Math.max(0.5, scale * 0.9);
				resize();
			} else if (avg < 13 && scale < 1) {
				scale = Math.min(1, scale * 1.05);
				resize();
			}
			acc = 0;
			frames = 0;
		}

		const t = (now - t0) / 1000 + skip;
		const stepDt = lastT >= 0 && t > lastT && t - lastT < 0.2 ? t - lastT : 0;
		lastT = t;

		for (let i = 0; i < N; i++) {
			const r = reeds[i];
			const ts = 0.4 + r.r1 * 0.35 * D;
			const age = t - ts;
			const th0 = 0.45 + ((r.seed * 3.7) % 1) * 0.5;
			const Tf = 0.9 + ((r.seed * 5.3) % 1) * 0.5;
			let th: number;
			let tipDepth: number;
			let landAge = -1;
			if (age < 0) {
				// rising at a slant, buoyant end first
				th = th0;
				tipDepth = -age * 0.22;
			} else if (age < Tf) {
				// the end has broken the surface; the stem topples like a falling pole
				const f = age / Tf;
				th = th0 * (1 - f * f);
				tipDepth = -0.012 * Math.sin(f * Math.PI);
			} else {
				landAge = age - Tf;
				th = 0.035 * Math.exp(-landAge * 4) * Math.abs(Math.sin(landAge * 10));
				tipDepth = 0;
			}

			const td = Math.max(0, age - Tf);
			const ramp = Math.min(1, td / 3);
			const fx = r.sx + r.vx * td + Math.sin(t * 0.6 + r.seed * 20) * 0.03 * ramp;
			const fz = r.sz + r.vz * td + Math.cos(t * 0.5 + r.seed * 11) * 0.03 * ramp;
			const fa = r.sa + r.w * td;
			let x = fx;
			let z = fz;
			let a = fa;
			let dockAge = -1;
			if (!r.stray) {
				const tA = Math.max(ts + Tf + 1.2, 0.3 * D + r.r2 * 0.4 * D + r.letter * 0.04 * D);
				const g = Math.max(2.5, 0.18 * D * (0.8 + 0.4 * r.r3));
				const u = (t - tA) / g;
				const s = smooth(u);
				if (s > 0) {
					const ddx = r.tx - fx;
					const ddz = r.tz - fz;
					// The turn is fixed when the glide starts: the heading it has then, and the
					// shorter way round to the target. Deciding it afresh each frame could flip
					// the turn mid-glide, and the tapered stem would swap ends on docking.
					const faA = r.sa + r.w * Math.max(0, tA - ts - Tf);
					const turn = wrapPi(r.ta - faA);
					if (u < 1) {
						// glide in on a shallow arc; the turn starts late and finishes with the glide
						const arc = Math.sin(Math.PI * s) * (r.r3 - 0.5) * 0.3;
						const s2 = smooth(u * 1.25 - 0.25);
						x = fx + ddx * s - ddz * arc;
						z = fz + ddz * s + ddx * arc;
						a = faA + (fa - faA) * (1 - s2) + turn * s2;
					} else {
						// docked: a small nudge along the way it came, easing in so it never jerks
						dockAge = t - (tA + g);
						const dl = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
						const ease = smooth(dockAge / 0.4);
						const settle = 0.012 * ease * Math.exp(-dockAge * 2.2) * Math.sin(dockAge * 7);
						x = r.tx + (ddx / dl) * settle;
						z = r.tz + (ddz / dl) * settle;
						a = faA + turn + 0.02 * ease * Math.exp(-dockAge * 2) * Math.sin(dockAge * 6);
					}
				}
			}

			// Glide velocity for the wake, smoothed over ~0.3 s whatever the frame rate.
			if (stepDt > 0 && r.px !== undefined && r.pz !== undefined) {
				const k = 1 - Math.exp(-stepDt / 0.3);
				r.svx = (r.svx || 0) + ((x - r.px) / stepDt - (r.svx || 0)) * k;
				r.svz = (r.svz || 0) + ((z - r.pz) / stepDt - (r.svz || 0)) * k;
			}
			r.px = x;
			r.pz = z;
			// Idle drift makes no wake: take a dead zone off the speed, keep the heading.
			const svx = r.svx || 0;
			const svz = r.svz || 0;
			const sp = Math.sqrt(svx * svx + svz * svz);
			const wake = landAge >= 0 && sp > 0.03 ? (sp - 0.03) / sp : 0;

			// Floating stems ride the same swell the water shows (the three long waves in
			// baseWaves), so neighbours move together and the finished word breathes.
			if (ramp > 0) {
				const p1 = (0.8 * x + 0.6 * z) * 2.1 + t * 0.9;
				const p2 = (-0.6 * x + 0.8 * z) * 3.3 + t * 1.3;
				const p3 = (0.3 * x - 0.95 * z) * 5.7 + t * 1.9;
				const c1 = 0.014 * Math.cos(p1) * ramp;
				const c2 = 0.0098 * Math.cos(p2) * ramp;
				const c3 = 0.0056 * Math.cos(p3) * ramp;
				x += 0.8 * c1 - 0.6 * c2 + 0.3 * c3;
				z += 0.6 * c1 + 0.8 * c2 - 0.95 * c3;
				a += (0.012 * Math.sin(p1 + 1.3) + 0.008 * Math.sin(p2 + 0.4)) * ramp;
			}

			// Projected shape of a tilted stem: the surfaced end stays put, the far end swings out as it falls.
			const c = Math.cos(th);
			const ccx = x + Math.cos(a) * r.hl * (1 - c);
			const ccz = z + Math.sin(a) * r.hl * (1 - c);
			const o = i * 4;
			const o2 = (N + i) * 4;
			const o3 = (2 * N + i) * 4;
			data[o] = ccx;
			data[o + 1] = ccz;
			data[o + 2] = a;
			data[o + 3] = r.hl * c;
			data[o2] = tipDepth;
			data[o2 + 1] = Math.max(age, -5);
			data[o2 + 2] = sp * wake;
			data[o2 + 3] = r.seed;
			data[o3] = Math.tan(th);
			data[o3 + 1] = landAge;
			data[o3 + 2] = r.hl;
			data[o3 + 3] = dockAge;
			const o4 = (3 * N + i) * 4;
			data[o4] = svx * wake;
			data[o4 + 1] = svz * wake;
		}

		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, 4, gl.RGBA, gl.FLOAT, data);
		const aspect = canvas.width / Math.max(1, canvas.height);
		gl.uniform2f(uRes, canvas.width, canvas.height);
		gl.uniform1f(uTime, t);
		gl.uniform1f(uCam, camHeight(aspect));
		gl.uniform4fv(uTouch, touches);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	};
	raf = requestAnimationFrame(loop);

	return {
		replay: () => {
			t0 = performance.now();
			touches.fill(0);
			lastT = -1;
			for (const r of reeds) r.px = r.pz = r.svx = r.svz = undefined;
		},
		destroy: () => {
			alive = false;
			cancelAnimationFrame(raf);
			ro.disconnect();
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerdown', onDown);
			gl.deleteTexture(tex);
			gl.deleteBuffer(buf);
			gl.deleteProgram(prog);
			gl.deleteShader(vs);
			gl.deleteShader(fs);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
		}
	};
}
