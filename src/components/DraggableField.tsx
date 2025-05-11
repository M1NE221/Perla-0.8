import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Draggable from 'react-draggable';

interface DraggableFieldProps {
  label: string;
  initialPosition: { x: number, y: number };
  isActive: boolean;
  onToggleActive: (label: string) => void;
  onDragStop: (label: string, position: { x: number, y: number }) => void;
  fixed?: boolean; // Optional prop to indicate if the field is in a fixed container
}

const DraggableField = ({ 
  label, 
  initialPosition, 
  isActive, 
  onToggleActive,
  onDragStop,
  fixed = false
}: DraggableFieldProps) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);

  // Update position if initialPosition changes from parent
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition]);

  const handleStart = () => {
    setIsDragging(true);
  };

  const handleStop = (e: any, data: { x: number, y: number }) => {
    setIsDragging(false);
    setPosition({ x: data.x, y: data.y });
    onDragStop(label, { x: data.x, y: data.y });
  };

  // Random slight offset for more organic floating appearance
  const randomOffset = Math.random() * 2;
  
  // Animation configurations
  const animations = {
    initial: { opacity: 0 },
    animate: { 
      y: fixed ? 0 : [0, -4 - randomOffset, 0],
      x: fixed ? 0 : [0, randomOffset, 0],
      opacity: isDragging ? 1 : [0.7, 0.9, 0.7]
    },
    transition: { 
      duration: 3 + (Math.random() * 2), 
      ease: "easeInOut", 
      repeat: Infinity,
      repeatType: "reverse" as const
    },
    whileHover: { 
      scale: 1.05, 
      opacity: 1,
      boxShadow: "0 0 8px rgba(223, 178, 96, 0.3)"
    },
    whileTap: { 
      scale: 0.95,
      boxShadow: "0 0 16px rgba(223, 178, 96, 0.4)" 
    }
  };

  const fieldContent = (
    <motion.div
      className={`${fixed ? '' : 'absolute'} cursor-move select-none px-4 py-2 rounded-xl font-mono text-xs
                ${isActive 
                  ? 'text-amber-700 border border-amber-300/40 bg-white/15 backdrop-blur-md shadow-inner' 
                  : 'text-slate-600 border border-white/10 bg-white/10 backdrop-blur-sm'}
                ${isDragging 
                  ? 'z-50 shadow-lg ring-1 ring-amber-300/30' 
                  : 'shadow-sm'}`}
      initial={animations.initial}
      animate={animations.animate}
      transition={animations.transition}
      whileHover={animations.whileHover}
      whileTap={animations.whileTap}
      onClick={() => !isDragging && onToggleActive(label)}
    >
      {label}
    </motion.div>
  );

  // If field is in a fixed container (like a vertical stack), don't use Draggable
  if (fixed) {
    return fieldContent;
  }

  // Otherwise, wrap in Draggable for free movement
  return (
    <Draggable
      position={position}
      onStart={handleStart}
      onStop={handleStop}
      bounds="parent"
      defaultClassNameDragging="z-50"
    >
      {fieldContent}
    </Draggable>
  );
};

export default DraggableField; 