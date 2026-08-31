
      precision highp float;

      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;

      varying float vDisplacement;
      varying float vVelocity;
      varying float vAudioMix;
      varying float vCenterActivity;
      varying float vDepth;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float distanceFromCenter = length(centered);
        if (distanceFromCenter > 0.5) {
          discard;
        }

        float core = 1.0 - smoothstep(0.0, 0.23, distanceFromCenter);
        float halo = 1.0 - smoothstep(0.08, 0.5, distanceFromCenter);
        float glow = core * 0.9 + halo * 0.52;

        float coolMix = clamp(0.2 + vVelocity * 0.72 + uMid * 0.32 + vDisplacement * 0.18, 0.0, 1.0);
        float hotMix = clamp(uBass * 0.9 + uTreble * 0.22 + vAudioMix * 0.22 + vDisplacement * 0.3 + vCenterActivity * 0.55, 0.0, 1.0);
        vec3 color = mix(uColorA, uColorB, coolMix);
        color = mix(color, uColorC, hotMix);
        color += uColorC * uTreble * (0.16 + core * 0.45);
        color += uColorC * vCenterActivity * (0.45 + core * 0.9);

        float brightness = 1.05 + hotMix * 1.25 + core * 0.35 + vCenterActivity * 1.5;
        float alpha = glow * (0.55 + hotMix * 0.58 + uTreble * 0.2 + vCenterActivity * 0.75) * (0.82 + vDepth * 0.18);
        gl_FragColor = vec4(color * brightness, alpha);
      }