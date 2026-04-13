'use client';

import { useEffect, useRef, useState } from 'react';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';

export default function ShaderGradientBackground({ disabled = false }: { disabled?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;

    let cancelled = false;
    const enable = () => {
      if (!cancelled) setEnabled(true);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if ('requestIdleCallback' in window) {
            (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback?.(enable);
          } else {
            setTimeout(enable, 250);
          }
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [disabled]);

  // Static fallback keeps the page visually rich with minimal GPU cost.
  if (disabled || !enabled) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 pointer-events-none bg-linear-to-br from-[#0B0D14] via-[#0f172a] to-[#141a2f]"
      />
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <ShaderGradientCanvas
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
        pixelDensity={1}
      >
        <ShaderGradient
          animate="on"
          brightness={0.5}
          cAzimuthAngle={180}
          cDistance={10}
          cPolarAngle={70}
          cameraZoom={1}
          color1="#0B0D14"
          color2="#0f172a"
          color3="#5B4DFF"
          envPreset="city"
          grain="off"
          lightType="3d"
          positionX={0}
          positionY={-1}
          positionZ={0}
          reflection={0}
          rotationX={0}
          rotationY={0}
          rotationZ={0}
          type="waterPlane"
          uDensity={1.5}
          uFrequency={5}
          uSpeed={0.1}
          uStrength={3}
          uTime={0.2}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
