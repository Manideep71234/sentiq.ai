import { useEffect, useRef } from 'react';

export default function MouseTracker() {
  const glowRef = useRef(null);
  const trailRef = useRef(null);
  
  // Track mouse and trail positions
  const mouse = useRef({ x: 0, y: 0 });
  const trail = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const rect = document.body.getBoundingClientRect();
      mouse.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // Instantly update the glow (main cursor)
      if (glowRef.current) {
        glowRef.current.style.left = `${mouse.current.x}px`;
        glowRef.current.style.top = `${mouse.current.y}px`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop for the trail
    let animationFrameId;
    const animateTrail = () => {
      // Ease the trail position towards the mouse position
      trail.current.x += (mouse.current.x - trail.current.x) * 0.15;
      trail.current.y += (mouse.current.y - trail.current.y) * 0.15;

      if (trailRef.current) {
        trailRef.current.style.left = `${trail.current.x}px`;
        trailRef.current.style.top = `${trail.current.y}px`;
      }

      animationFrameId = requestAnimationFrame(animateTrail);
    };
    
    animateTrail();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <div 
        ref={glowRef}
        className="mouse-glow" 
        style={{
          pointerEvents: 'none',
          zIndex: 9999,
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          width: '8px',
          height: '8px',
          background: 'var(--accent-color)',
          borderRadius: '50%',
          boxShadow: '0 0 10px var(--accent-color), 0 0 20px var(--accent-color)'
        }} 
      />
      <div 
        ref={trailRef}
        className="mouse-trail" 
        style={{
          pointerEvents: 'none',
          zIndex: 9998,
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          width: '24px',
          height: '24px',
          border: '2px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '50%',
          transition: 'width 0.2s, height 0.2s'
        }} 
      />
    </>
  );
}
