import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TypingResponseProps {
  text: string;
  typingSpeed?: number;
  className?: string;
}

const TypingResponse = ({ 
  text = '', // Provide default empty string to avoid undefined issues
  typingSpeed = 25,
  className = ''
}: TypingResponseProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [scrambledChar, setScrambledChar] = useState('');
  
  // Matrix character scramble effect
  useEffect(() => {
    if (isTyping) {
      const matrixChars = '01αβγδεζηθικλμνξοπρστυφχψωАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
      const interval = setInterval(() => {
        const randomChar = matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));
        setScrambledChar(randomChar);
      }, 50);
      
      return () => clearInterval(interval);
    }
  }, [isTyping]);

  // Reset and start typing when text changes
  useEffect(() => {
    if (text) {
      // Reset when text changes
      setDisplayedText('');
      setCurrentIndex(0);
      setIsTyping(true);
    }
  }, [text]);

  // Handle the typing animation effect
  useEffect(() => {
    // Only proceed if we have text to display
    if (!text) {
      return;
    }
    
    if (currentIndex < text.length && isTyping) {
      // Variable typing speed for more natural effect
      const variableSpeed = Math.random() * 10 + typingSpeed;
      
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, variableSpeed);

      return () => clearTimeout(timer);
    } else if (currentIndex >= text.length && text.length > 0) {
      setIsTyping(false);
    }
  }, [currentIndex, text, typingSpeed, isTyping]);
  
  // Handle empty text case
  if (!text) {
    return <div className={`font-mono relative ${className} text-red-500`}>Texto vacío recibido</div>;
  }
  
  // Split the text into array to apply character-by-character animations
  const characters = displayedText.split('');

  return (
    <div className={`font-mono relative ${className}`}>
      {characters.length > 0 ? (
        characters.map((char, index) => (
          <motion.span
            key={`${index}-${char}`}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.1 }}
            className={index === characters.length - 1 ? 'text-white' : ''}
          >
            {char}
          </motion.span>
        ))
      ) : (
        // If no characters yet but we have text, show a blinking cursor
        text && isTyping && (
          <motion.span
            className="inline-block w-2 h-4 bg-green-500"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ 
              duration: 0.5, 
              repeat: Infinity,
              repeatType: "loop"
            }}
          />
        )
      )}
      {isTyping && (
        <>
          <motion.span
            className="inline-block text-green-400/80"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ 
              duration: 0.2, 
              repeat: Infinity,
              repeatType: "loop"
            }}
          >
            {scrambledChar}
          </motion.span>
          <motion.span
            className="inline-block w-2 h-4 bg-green-500 ml-1"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ 
              duration: 0.5, 
              repeat: Infinity,
              repeatType: "loop"
            }}
          />
        </>
      )}
    </div>
  );
};

export default TypingResponse; 