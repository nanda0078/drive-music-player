import React, { useRef, useState, useEffect } from "react";

interface MarqueeSongTitleProps {
  text: string;
  className?: string;
  id?: string;
}

export const MarqueeSongTitle: React.FC<MarqueeSongTitleProps> = ({
  text,
  className = "",
  id,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  useEffect(() => {
    const calculateOverflow = () => {
      if (!containerRef.current || !textRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;

      // Aktifkan animasi running text hanya jika judul melebihi lebar area kontainer
      if (textWidth > containerWidth + 4) {
        const overflow = textWidth - containerWidth + 24; // buffer agar huruf paling akhir terbaca penuh
        setIsOverflowing(true);
        setDistance(overflow);
        // Kecepatan membaca nyaman ~26px per detik + jeda 3.6 detik (1.8s di awal & 1.8s di akhir)
        const scrollSeconds = overflow / 26;
        const totalDuration = Math.max(5, scrollSeconds + 3.6);
        setDuration(totalDuration);
      } else {
        setIsOverflowing(false);
        setDistance(0);
        setDuration(0);
      }
    };

    calculateOverflow();

    const observer = new ResizeObserver(() => {
      calculateOverflow();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [text]);

  return (
    <div
      ref={containerRef}
      id={id ? `${id}-container` : undefined}
      className="w-full overflow-hidden whitespace-nowrap select-none flex items-center min-w-0"
    >
      <h2
        ref={textRef}
        id={id}
        className={`inline-block whitespace-nowrap leading-tight transition-transform ${className} ${
          isOverflowing ? "animate-title-marquee" : ""
        }`}
        style={
          isOverflowing
            ? ({
                "--marquee-distance": `-${distance}px`,
                animationDuration: `${duration}s`,
              } as React.CSSProperties)
            : undefined
        }
        title={text}
      >
        {text}
      </h2>
    </div>
  );
};
