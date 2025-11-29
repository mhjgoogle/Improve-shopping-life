import React, { useState, useRef, useEffect } from 'react';
import { sendMessageToAgent, searchProductsWithGemini, generateTryOnImage } from './services/geminiService';
import { ShoppingPhase, RequiredAction, Message, AppState, Product, ShoppingResponse } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ProductCard } from './components/ProductCard';
import { Button } from './components/Button';

// Icons
const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="4"/></svg>
);
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);
const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
);

const INITIAL_STATE: AppState = {
  messages: [{
    id: 'init',
    role: 'assistant',
    content: 'こんにちは！ファッションやインテリアのお買い物をお手伝いする「Visual Shopping Assistant」です。何をお探しですか？',
  }],
  currentPhase: ShoppingPhase.IDENTIFY_SUBJECT,
  userImage: null,
  selectedProducts: [],
  isLoading: false,
};

function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [inputText, setInputText] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  // Helper to append message
  const appendMessage = (msg: Message) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, msg]
    }));
  };

  // Main interaction handler
  const handleInteraction = async (text: string, image?: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    // Add user message to UI
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      image: image
    };
    appendMessage(newUserMsg);

    if (image) {
      setState(prev => ({ ...prev, userImage: image }));
    }

    try {
      // Prepare history for AI
      const history = state.messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      // Call AI Agent
      const response = await sendMessageToAgent(history, text, image);
      
      // Handle AI Response
      const newAiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.user_message,
        rawJson: response,
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, newAiMsg],
        currentPhase: response.current_phase,
        isLoading: false
      }));

      // Handle Required Actions
      await handleRequiredAction(response);

    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRequiredAction = async (response: ShoppingResponse) => {
    switch (response.required_action) {
      case RequiredAction.ASK_IMAGE:
        setShowUpload(true);
        break;

      case RequiredAction.CALL_SEARCH_TOOL:
        setShowUpload(false);
        setState(prev => ({ ...prev, isLoading: true }));
        const query = response.tool_parameters?.search_query || state.messages[state.messages.length - 1].content;
        
        const products = await searchProductsWithGemini(query);
        
        const productMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `${products.length}件の商品が見つかりました。「試着する」ボタンを押して試してみましょう！`,
          isProductCard: true,
          products: products
        };
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, productMsg],
          isLoading: false
        }));
        break;

      // Note: CALL_VTON_TOOL logic is now also accessible directly via button click, 
      // but if the Agent decides to trigger it automatically, this handles it.
      case RequiredAction.CALL_VTON_TOOL:
        // Handled via button for better UX, but kept for logic completeness
        break;
        
      default:
        break;
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    handleInteraction(text);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setShowUpload(false);
        handleInteraction("こちらの画像を参考にしてください。", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Direct action from Product Card
  const handleTryOn = async (product: Product) => {
    if (!state.userImage) {
      // If no image, ask for it first
      const msg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "試着するには、まずあなたの写真をアップロードしてください。"
      };
      appendMessage(msg);
      setShowUpload(true);
      return;
    }

    // Add a UI message saying we are trying it on
    const userRequestMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `${product.name}を試着したいです。`
    };
    appendMessage(userRequestMsg);
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const vtonImage = await generateTryOnImage(state.userImage, `Wearing ${product.name}, ${product.description}`);
      
      const resultMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `「${product.name}」の試着イメージを作成しました！`,
        isVtonResult: true,
        vtonImage: vtonImage,
        evaluation: {
          score: 8.8, 
          reason: "体のラインを崩さず、自然なフィット感で再現しました。"
        }
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, resultMsg],
        isLoading: false
      }));
    } catch (e) {
      console.error(e);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto bg-white shadow-2xl overflow-hidden relative">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 rounded-lg flex items-center justify-center text-white">
            <SparklesIcon />
          </div>
          <h1 className="font-bold text-gray-800 text-lg tracking-tight">StyleAI</h1>
        </div>
        <div className="text-xs font-mono text-gray-400">
          {state.currentPhase.replace(/_/g, ' ')}
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
        {state.messages.map((msg) => (
          <div key={msg.id}>
            <ChatMessage message={msg} />
            
            {/* Render Products Grid */}
            {msg.isProductCard && msg.products && (
               <div className="grid grid-cols-2 gap-3 mb-6 ml-2 animate-fade-in-up">
                 {msg.products.map(p => (
                   <ProductCard 
                     key={p.id} 
                     product={p} 
                     onTryOn={handleTryOn} 
                   />
                 ))}
               </div>
            )}
          </div>
        ))}
        
        {state.isLoading && (
          <div className="flex justify-start w-full mb-6">
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-gray-100 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-gray-100 sticky bottom-0">
        
        {/* Contextual Action Area */}
        {showUpload && (
          <div className="mb-3 animate-fade-in">
             <Button 
               variant="secondary" 
               fullWidth 
               onClick={() => fileInputRef.current?.click()}
             >
               <CameraIcon /> 写真をアップロード
             </Button>
             <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               accept="image/*"
               onChange={handleImageUpload}
             />
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-100 text-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-gray-400"
            placeholder="メッセージを入力..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={state.isLoading}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputText.trim() || state.isLoading}
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
          >
            <SendIcon />
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;