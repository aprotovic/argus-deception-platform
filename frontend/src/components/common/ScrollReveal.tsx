import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number; // ms delay
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale' | 'none';
  distance?: string; // e.g. '28px'
  duration?: number; // in seconds
  className?: string;
  style?: React.CSSProperties;
  threshold?: number;
  once?: boolean;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  delay = 0,
  direction = 'up',
  distance = '28px',
  duration = 0.65,
  className = '',
  style = {},
  threshold = 0.1,
  once = true,
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const domRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // If IntersectionObserver is not supported, default to visible
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once && domRef.current) {
            observer.unobserve(domRef.current);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const currentEl = domRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
    };
  }, [threshold, once]);

  const getTransform = () => {
    if (isVisible) return 'translate3d(0, 0, 0) scale(1)';
    switch (direction) {
      case 'up':
        return `translate3d(0, ${distance}, 0)`;
      case 'down':
        return `translate3d(0, -${distance}, 0)`;
      case 'left':
        return `translate3d(${distance}, 0, 0)`;
      case 'right':
        return `translate3d(-${distance}, 0, 0)`;
      case 'scale':
        return 'scale(0.92)';
      case 'none':
        return 'none';
      default:
        return `translate3d(0, ${distance}, 0)`;
    }
  };

  return (
    <div
      ref={domRef}
      className={className}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transition: `opacity ${duration}s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
};
