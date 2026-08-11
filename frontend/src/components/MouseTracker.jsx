import { useEffect, useRef } from 'react';

const TRAIL_LENGTH = 15;

export default function MouseTracker() {
  const glowRef = useRef(null);
  
  // Array of trail dots refs
  const trailRefs = useRef([]);
  // We keep a mutable array of positions for the trail
  const trailPositions = useRef(Array(TRAIL_LENGTH).fill({ x: 0, y: 0 }));
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Hide default cursor across the app
    document.body.style.cursor = 'none';

    const handleMouseMove = (e) => {
      const rect = document.body.getBoundingClientRect();
      mouse.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // Instantly update the main dot
      if (glowRef.current) {
        glowRef.current.style.left = `${mouse.current.x}px`;
        glowRef.current.style.top = `${mouse.current.y}px`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    let animationFrameId;
    const animateTrail = () => {
      // The first point follows the mouse
      let nextX = mouse.current.x;
      let nextY = mouse.current.y;
      
      // Update each trail point to follow the previous one
      const updatedPositions = [...trailPositions.current];
      
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        const current = updatedPositions[i];
        
        // Easing factor: points closer to the head follow faster, tail follows slower
        const ease = 0.35 - (i * 0.015);
        
        current.x += (nextX - current.x) * ease;
        current.y += (nextY - current.y) * ease;
        
        // Apply position to DOM node
        const ref = trailRefs.current[i];
        if (ref) {
          ref.style.left = `${current.x}px`;
          ref.style.top = `${current.y}px`;
        }
        
        // The next point follows this current point
        nextX = current.x;
        nextY = current.y;
      }
      
      trailPositions.current = updatedPositions;
      animationFrameId = requestAnimationFrame(animateTrail);
    };
    
    animateTrail();

    return () => {
      document.body.style.cursor = 'auto';
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* Main mouse dot */}
      <div 
        ref={glowRef}
        className="mouse-glow" 
        style={{
          pointerEvents: 'none',
          zIndex: 9999,
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          width: '5px',
          height: '5px',
          background: '#fff',
          borderRadius: '50%',
          boxShadow: '0 0 10px #fff, 0 0 20px var(--accent-color)'
        }} 
      />
      
      {/* Comet trail */}
      {Array.from({ length: TRAIL_LENGTH }).map((_, index) => {
        // Calculate decreasing size and opacity for the tail
        const size = Math.max(1, 8 - (index * 0.45));
        const opacity = 1 - (index / TRAIL_LENGTH);
        
        return (
          <div 
            key={index}
            ref={el => trailRefs.current[index] = el}
            style={{
              pointerEvents: 'none',
              zIndex: 9998 - index,
              position: 'absolute',
              transform: 'translate(-50%, -50%)',
              width: `${size}px`,
              height: `${size}px`,
              background: 'var(--accent-color)',
              opacity: opacity * 0.7,
              borderRadius: '50%',
              boxShadow: `0 0 ${size * 2}px var(--accent-color)`
            }} 
          />
        );
      })}
    </>
  );
}
