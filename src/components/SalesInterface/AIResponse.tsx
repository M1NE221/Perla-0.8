'use client';

import React from 'react';

interface AIResponseProps {
  messages: { role: 'user' | 'assistant'; content: string }[]; // Array of message objects
  // We can add more props later, e.g., for loading states or styling variants
}

const AIResponse: React.FC<AIResponseProps> = ({ messages }) => {
  if (!messages || messages.length === 0) {
    return null; // Don't render anything if there are no messages
  }

  return (
    <div className="w-full p-4 my-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
        Respuesta de la IA:
      </h3>
      <div className="space-y-2">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded-md ${
              msg.role === 'assistant'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-right'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIResponse;
