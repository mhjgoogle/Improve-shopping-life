export enum ShoppingPhase {
  IDENTIFY_SUBJECT = "IDENTIFY_SUBJECT",
  GET_USER_IMAGE = "GET_USER_IMAGE",
  PREFERENCE_SEARCH = "PREFERENCE_SEARCH",
  SELECT_PRODUCT = "SELECT_PRODUCT",
  VIRTUAL_TRYON = "VIRTUAL_TRYON",
  EVALUATION = "EVALUATION"
}

export enum RequiredAction {
  NONE = "NONE",
  ASK_IMAGE = "ASK_IMAGE",
  CALL_SEARCH_TOOL = "CALL_SEARCH_TOOL",
  CALL_VTON_TOOL = "CALL_VTON_TOOL",
  CALL_EVAL_TOOL = "CALL_EVAL_TOOL"
}

export interface ShoppingResponse {
  thought: string;
  user_message: string;
  current_phase: ShoppingPhase;
  required_action: RequiredAction;
  tool_parameters?: Record<string, any>;
}

export interface Product {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  description: string;
  link?: string;
  source?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string; // Used for display
  rawJson?: ShoppingResponse; // Used for logic
  image?: string; // Base64 data URI
  isProductCard?: boolean;
  products?: Product[];
  isVtonResult?: boolean;
  vtonImage?: string;
  evaluation?: {
    score: number;
    reason: string;
  };
}

export interface AppState {
  messages: Message[];
  currentPhase: ShoppingPhase;
  userImage: string | null; // Base64
  selectedProducts: Product[]; // Changed to array for multi-select
  isLoading: boolean;
}