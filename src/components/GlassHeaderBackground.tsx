import { MeshTransmissionMaterial, RoundedBox, Float } from '@react-three/drei';

export function GlassBackground3D({ width = 4 }: { width?: number }) {
  return (
    <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
      <RoundedBox 
        args={[width, 1.8, 0.5]} 
        radius={0.25} 
        smoothness={4} 
        position={[0, 0, 0]}
      >
        <MeshTransmissionMaterial
          backside
          samples={4}
          thickness={2}
          chromaticAberration={2}
          anisotropy={0.5}
          distortion={0.5}
          distortionScale={0.5}
          temporalDistortion={0.1}
          ior={1.2}
          color="#ffffff"
          roughness={0.1}
          clearcoat={1}
        />
      </RoundedBox>
    </Float>
  );
}
