import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWorkspace } from './WorkspaceContext';
import { aiApi, ChatResponsePayload } from '../api/ai';
import { ChatMessage, PendingApproval } from '../types/ai';

interface AIConversationContextType {
  messages: ChatMessage[];
  conversationId: string | undefined;
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  approveAction: (approvalId: string) => Promise<void>;
  rejectAction: (approvalId: string, reason?: string) => Promise<void>;
  clearConversation: () => void;
}

const AIConversationContext = createContext<AIConversationContextType | undefined>(undefined);

const STORAGE_PREFIX = 'startupai_chat_thread_';

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  sender: 'agent',
  content: "Hello! I'm your Autonomous Startup Manager. How can I assist with your runway, tasks, or strategy today?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

export const AIConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentWorkspace } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME_MESSAGE]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  // Load conversation from storage when workspace changes
  useEffect(() => {
    if (!currentWorkspace?.id) {
      setMessages([DEFAULT_WELCOME_MESSAGE]);
      setConversationId(undefined);
      return;
    }

    try {
      const saved = sessionStorage.getItem(`${STORAGE_PREFIX}${currentWorkspace.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
          setConversationId(parsed.conversationId);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached AI conversation:', e);
    }

    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setConversationId(undefined);
  }, [currentWorkspace?.id]);

  // Persist conversation to sessionStorage whenever messages or conversationId changes
  useEffect(() => {
    if (!currentWorkspace?.id) return;
    try {
      sessionStorage.setItem(
        `${STORAGE_PREFIX}${currentWorkspace.id}`,
        JSON.stringify({
          conversationId,
          messages,
        })
      );
    } catch (e) {
      console.warn('Failed to persist AI conversation:', e);
    }
  }, [currentWorkspace?.id, conversationId, messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || !currentWorkspace) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res: ChatResponsePayload = await aiApi.chat(
          currentWorkspace.id,
          trimmed,
          conversationId
        );

        if (res.conversation_id) {
          setConversationId(res.conversation_id);
        }

        const agentMsg: ChatMessage = {
          id: res.run_id || `agent-${Date.now()}`,
          sender: 'agent',
          content: res.response,
          plan: res.plan,
          tokens_used: res.tokens_used,
          execution_time_ms: res.execution_time_ms,
          pending_approvals: res.pending_approvals as PendingApproval[],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, agentMsg]);
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          sender: 'agent',
          content: `⚠️ Error: ${err?.message || 'Failed to reach AI Manager service. Please try again.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, currentWorkspace, isLoading]
  );

  const approveAction = useCallback(
    async (approvalId: string) => {
      if (!currentWorkspace) return;
      try {
        await aiApi.approve(currentWorkspace.id, approvalId);
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.pending_approvals) {
              return {
                ...msg,
                pending_approvals: msg.pending_approvals.filter((a) => a.approval_id !== approvalId),
              };
            }
            return msg;
          })
        );
      } catch (err: any) {
        alert(`Approval failed: ${err?.message || err}`);
      }
    },
    [currentWorkspace]
  );

  const rejectAction = useCallback(
    async (approvalId: string, reason?: string) => {
      if (!currentWorkspace) return;
      try {
        await aiApi.reject(currentWorkspace.id, approvalId, reason || 'Rejected by user');
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.pending_approvals) {
              return {
                ...msg,
                pending_approvals: msg.pending_approvals.filter((a) => a.approval_id !== approvalId),
              };
            }
            return msg;
          })
        );
      } catch (err: any) {
        alert(`Rejection failed: ${err?.message || err}`);
      }
    },
    [currentWorkspace]
  );

  const clearConversation = useCallback(() => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setConversationId(undefined);
    if (currentWorkspace?.id) {
      sessionStorage.removeItem(`${STORAGE_PREFIX}${currentWorkspace.id}`);
    }
  }, [currentWorkspace?.id]);

  return (
    <AIConversationContext.Provider
      value={{
        messages,
        conversationId,
        isLoading,
        sendMessage,
        approveAction,
        rejectAction,
        clearConversation,
      }}
    >
      {children}
    </AIConversationContext.Provider>
  );
};

export const useAIConversation = (): AIConversationContextType => {
  const context = useContext(AIConversationContext);
  if (!context) {
    throw new Error('useAIConversation must be used within an AIConversationProvider');
  }
  return context;
};
