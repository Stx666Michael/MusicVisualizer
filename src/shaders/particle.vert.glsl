
      precision highp float;

      uniform float uTime;
      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform float uImpulse;
      uniform float uScale;
      uniform float uShape;
      uniform float uPixelRatio;
      uniform float uPointSize;

      attribute vec3 aRandom;
      attribute float aSize;

      varying float vDisplacement;
      varying float vVelocity;
      varying float vAudioMix;
      varying float vCenterActivity;
      varying float vDepth;

      vec3 mod289(vec3 value) {
        return value - floor(value * (1.0 / 289.0)) * 289.0;
      }

      vec4 mod289(vec4 value) {
        return value - floor(value * (1.0 / 289.0)) * 289.0;
      }

      vec4 permute(vec4 value) {
        return mod289(((value * 34.0) + 1.0) * value);
      }

      vec4 taylorInvSqrt(vec4 value) {
        return 1.79284291400159 - 0.85373472095314 * value;
      }

      float snoise(vec3 value) {
        const vec2 corner = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 simplex = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 cell = floor(value + dot(value, corner.yyy));
        vec3 local = value - cell + dot(cell, corner.xxx);
        vec3 greater = step(local.yzx, local.xyz);
        vec3 lesser = 1.0 - greater;
        vec3 first = min(greater.xyz, lesser.zxy);
        vec3 second = max(greater.xyz, lesser.zxy);
        vec3 local1 = local - first + corner.xxx;
        vec3 local2 = local - second + corner.yyy;
        vec3 local3 = local - simplex.yyy;

        cell = mod289(cell);
        vec4 permutation = permute(
          permute(
            permute(cell.z + vec4(0.0, first.z, second.z, 1.0)) +
            cell.y + vec4(0.0, first.y, second.y, 1.0)
          ) +
          cell.x + vec4(0.0, first.x, second.x, 1.0)
        );

        const float inverseSeven = 0.142857142857;
        vec3 noiseScale = inverseSeven * simplex.wyz - simplex.xzx;
        vec4 gradientIndex = permutation - 49.0 * floor(permutation * noiseScale.z * noiseScale.z);
        vec4 gradientX = floor(gradientIndex * noiseScale.z);
        vec4 gradientY = floor(gradientIndex - 7.0 * gradientX);
        vec4 gradient = gradientX * noiseScale.x + noiseScale.yyyy;
        vec4 gradient2 = gradientY * noiseScale.x + noiseScale.yyyy;
        vec4 height = 1.0 - abs(gradient) - abs(gradient2);
        vec4 lower = floor(gradient) * 2.0 + 1.0;
        vec4 upper = floor(gradient2) * 2.0 + 1.0;
        vec4 heightSign = -step(height, vec4(0.0));
        vec4 adjustedLower = gradient.xzyw + lower.xzyw * heightSign.xxyy;
        vec4 adjustedUpper = gradient2.xzyw + upper.xzyw * heightSign.zzww;

        vec3 gradient0 = vec3(adjustedLower.xy, height.x);
        vec3 gradient1 = vec3(adjustedLower.zw, height.y);
        vec3 gradient2Value = vec3(adjustedUpper.xy, height.z);
        vec3 gradient3 = vec3(adjustedUpper.zw, height.w);
        vec4 normalization = taylorInvSqrt(vec4(
          dot(gradient0, gradient0),
          dot(gradient1, gradient1),
          dot(gradient2Value, gradient2Value),
          dot(gradient3, gradient3)
        ));

        gradient0 *= normalization.x;
        gradient1 *= normalization.y;
        gradient2Value *= normalization.z;
        gradient3 *= normalization.w;

        vec4 falloff = max(
          0.6 - vec4(
            dot(local, local),
            dot(local1, local1),
            dot(local2, local2),
            dot(local3, local3)
          ),
          0.0
        );
        falloff *= falloff;
        return 42.0 * dot(
          falloff * falloff,
          vec4(
            dot(gradient0, local),
            dot(gradient1, local1),
            dot(gradient2Value, local2),
            dot(gradient3, local3)
          )
        );
      }

      void main() {
        vec3 basePosition = position;
        float time = uTime;
        float planeAudio = clamp(uBass * 0.8 + uMid * 0.65 + uTreble * 0.3, 0.0, 1.0);
        float planeCenterWeight = 0.0;
        float planeMotionWeight = 1.0;

        if (uShape > 0.5 && uShape < 1.5) {
          planeCenterWeight = 1.0 - smoothstep(0.0, 1.48, length(basePosition.xy));
          planeMotionWeight = planeCenterWeight * (1.0 + planeCenterWeight * 1.75);
          float planeSpread = mix(0.0, 1.0, planeAudio);
          basePosition.x *= planeSpread;
          basePosition.z *= planeAudio;
          basePosition.z += sin(time * 4.0 + basePosition.y * 3.0) * planeMotionWeight * planeAudio * 0.12;
          basePosition.y += cos(time * 3.0 + basePosition.x * 2.0) * planeMotionWeight * planeAudio * 0.035;
        }

        float radius = length(basePosition);
        vec3 normal = normalize(basePosition + vec3(0.00001));

        float broadNoise = snoise(
          basePosition * 1.55 + vec3(time * 0.12, -time * 0.08, time * 0.1)
        );
        float structureNoise = snoise(
          basePosition * 3.4 + vec3(-time * 0.24, time * 0.18, time * 0.2)
        );
        vec3 flowNoise = vec3(
          snoise(basePosition * 2.1 + vec3(time * 0.25, 0.0, 0.0)),
          snoise(basePosition * 2.1 + vec3(0.0, time * 0.21, 0.0)),
          snoise(basePosition * 2.1 + vec3(0.0, 0.0, time * 0.23))
        );

        float pulseWave = sin(time * (1.0 + uBass * 4.0) + radius * 4.0 + broadNoise * 2.5);
        float bassExpansion = (uBass * 0.235 + uImpulse * 0.32) * planeMotionWeight;
        float midWave = (broadNoise * 0.15 + pulseWave * 0.035) * uMid * planeMotionWeight;
        float trebleDetail = structureNoise * 0.045 * uTreble * planeMotionWeight;

        vec3 displaced = basePosition * (1.0 + bassExpansion);
        displaced += normal * (midWave + trebleDetail);
        displaced += flowNoise * (0.045 * uMid + 0.025 * uTreble) * planeMotionWeight;
        displaced += normal * sin(time * 18.0 + aRandom.x * 62.8318) * uTreble * 0.012 * planeMotionWeight;

        float localScale = uScale;
        if (uShape > 0.5 && uShape < 1.5) {
          localScale = 1.0 + (uScale - 1.0) * planeCenterWeight;
        }

        vec4 modelViewPosition = modelViewMatrix * vec4(displaced * localScale, 1.0);
        gl_Position = projectionMatrix * modelViewPosition;

        float perspectiveSize = 300.0 / max(1.0, -modelViewPosition.z);
        gl_PointSize = clamp(
          uPointSize * aSize * uPixelRatio * perspectiveSize *
          (1.0 + uTreble * 0.22 + planeCenterWeight * (0.55 + planeAudio * 1.25)),
          1.0,
          64.0
        );

        vDisplacement = clamp((abs(midWave) + abs(trebleDetail) * 1.4 + uImpulse * 0.2) * planeMotionWeight, 0.0, 1.0);
        vVelocity = clamp((length(flowNoise) * 0.55 + abs(pulseWave) * uMid * 0.25) * planeMotionWeight, 0.0, 1.0);
        vAudioMix = clamp(uBass * 0.8 + uMid * 0.35 + uTreble * 0.25, 0.0, 1.0);
        vCenterActivity = planeCenterWeight * (0.35 + planeAudio * 0.65);
        vDepth = clamp(1.0 - (-modelViewPosition.z / 10.0), 0.0, 1.0);
      }