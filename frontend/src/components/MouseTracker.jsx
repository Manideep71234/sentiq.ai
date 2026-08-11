import { useEffect, useRef, useState } from 'react';

const TRAIL_LENGTH = 15;

export default function MouseTracker() {
  const glowRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  
  // Array of trail dots refs
  const trailRefs = useRef([]);
  // We keep a mutable array of positions for the trail
  const trailPositions = useRef(Array(TRAIL_LENGTH).fill({ x: 0, y: 0 }));
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Hide default cursor across the app by injecting a global style
    const style = document.createElement('style');
    style.innerHTML = `* { cursor: none !important; }`;
    document.head.appendChild(style);

    const handleMouseMove = (e) => {
      // Use clientX/Y directly for position: fixed
      mouse.current = {
        x: e.clientX,
        y: e.clientY
      };
      
      // Instantly update the main dot
      if (glowRef.current) {
        glowRef.current.style.left = `${mouse.current.x}px`;
        glowRef.current.style.top = `${mouse.current.y}px`;
      }

      // Check if hovering over clickable element
      const target = e.target;
      const isClickable = target && (
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.tagName === 'INPUT' || 
        target.tagName === 'SELECT' || 
        target.closest('button') || 
        target.closest('a') ||
        window.getComputedStyle(target).cursor === 'pointer'
      );
      
      setIsHovering(!!isClickable);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

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
      document.head.removeChild(style);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* Main mouse dot */}
      <div 
        ref={glowRef}
        className="custom-mouse-dot" 
        style={{
          pointerEvents: 'none',
          zIndex: 99999,
          position: 'fixed', // Use fixed for perfect viewport alignment
          transform: 'translate(-50%, -50%)',
          width: isHovering ? '12px' : '5px',
          height: isHovering ? '12px' : '5px',
          background: isHovering ? 'transparent' : '#fff',
          border: isHovering ? '2px solid var(--accent-color)' : 'none',
          borderRadius: '50%',
          boxShadow: isHovering ? 'none' : '0 0 10px #fff, 0 0 20px var(--accent-color)',
          transition: 'width 0.2s ease, height 0.2s ease, background 0.2s ease, border 0.2s ease'
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
              zIndex: 99998 - index,
              position: 'fixed',
              transform: 'translate(-50%, -50%)',
              width: `${size}px`,
              height: `${size}px`,
              background: 'var(--accent-color)',
              opacity: isHovering ? 0 : opacity * 0.7, // Hide tail when hovering
              borderRadius: '50%',
              boxShadow: `0 0 ${size * 2}px var(--accent-color)`,
              transition: 'opacity 0.2s ease'
            }} 
          />
        );
      })}
    </>
  );
}
