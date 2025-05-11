'use client';

import React from 'react';

interface UserInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isProcessing?: boolean;
}

const UserInput: React.FC<UserInputProps> = ({ 
  inputValue, 
  onInputChange, 
  onSubmit, 
  isProcessing 
}) => {
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isProcessing) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="w-full p-4 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <div className="flex items-center border-b border-gray-300 dark:border-gray-600 py-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Escribe una venta o consulta..."
          className="appearance-none bg-transparent border-none w-full text-gray-700 dark:text-gray-200 mr-3 py-1 px-2 leading-tight focus:outline-none"
          disabled={isProcessing}
        />
        <button 
          type="submit" 
          className="flex-shrink-0 bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700 text-sm border-4 text-white py-1 px-2 rounded disabled:opacity-50"
          disabled={isProcessing}
        >
          {isProcessing ? 'Procesando...' : 'Enviar'}
        </button>
        {/* Placeholder for Voice Input Icon */}
        {/* <button type="button" className="ml-2 p-2 focus:outline-none">
          <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">ICON_SVG_PATH</svg>
        </button> */}
      </div>
    </form>
  );
};

export default UserInput; 