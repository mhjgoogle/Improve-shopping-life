import React from 'react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Text Bubble */}
        <div className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm
          ${isUser 
            ? 'bg-indigo-600 text-white rounded-br-none' 
            : 'bg-white border border-gray-100 text-gray-700 rounded-bl-none'
          }`}
        >
          {message.content}
        </div>

        {/* Image Attachment (User upload) */}
        {message.image && !message.isVtonResult && (
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 shadow-sm w-48">
            <img src={message.image} alt="Uploaded" className="w-full h-auto object-cover" />
          </div>
        )}

        {/* VTON Result Display */}
        {message.isVtonResult && message.vtonImage && (
          <div className="mt-3 overflow-hidden rounded-2xl border-4 border-fuchsia-100 shadow-md w-64 bg-white">
            <div className="bg-fuchsia-50 text-fuchsia-800 text-xs font-bold px-3 py-1 text-center">
              VIRTUAL TRY-ON RESULT
            </div>
            <img src={message.vtonImage} alt="Try-on Result" className="w-full h-auto object-cover" />
            {message.evaluation && (
               <div className="p-3 bg-white">
                 <div className="flex justify-between items-center mb-1">
                   <span className="text-xs text-gray-500 font-semibold">MATCH SCORE</span>
                   <span className="text-lg font-bold text-indigo-600">{message.evaluation.score}/10</span>
                 </div>
                 <p className="text-xs text-gray-600 italic">"{message.evaluation.reason}"</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};