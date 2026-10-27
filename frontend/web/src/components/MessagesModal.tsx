import React, { useState } from 'react';
import { X, Send, ArrowLeft, CheckCheck } from 'lucide-react';
import { Conversation } from '../types';

interface MessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSendMessage: (conversationId: string, text: string) => void;
  activeConversationId?: string;
}

export const MessagesModal: React.FC<MessagesModalProps> = ({
  isOpen,
  onClose,
  conversations,
  onSendMessage,
  activeConversationId,
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string>(
    activeConversationId || (conversations[0]?.id || '')
  );
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const currentConversation = conversations.find((c) => c.id === selectedConvId) || conversations[0];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentConversation) return;

    onSendMessage(currentConversation.id, inputText.trim());
    setInputText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[600px] max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E4F2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base sm:text-lg text-[#1F1B3D]">
              Сообщения и чаты со студиями
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Pane Chat layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Dialogs List */}
          <div className="w-1/3 min-w-[200px] border-r border-[#E5E4F2] overflow-y-auto bg-[#F7F6FC]">
            {conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3 border-b border-[#E5E4F2]/60 cursor-pointer transition-colors flex items-center gap-3 ${
                    isSelected ? 'bg-white font-bold' : 'hover:bg-[#EEEAFB]/60'
                  }`}
                >
                  <img
                    src={conv.avatar}
                    alt={conv.activityTitle}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#1F1B3D] truncate">
                        {conv.activityTitle}
                      </span>
                      <span className="text-[10px] text-[#858394] shrink-0">
                        {conv.lastMessageTime}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5B5870] truncate mt-0.5">
                      {conv.lastMessage}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Active Chat Conversation */}
          {currentConversation ? (
            <div className="flex-1 flex flex-col bg-white">
              {/* Chat Subheader */}
              <div className="p-3 border-b border-[#E5E4F2] flex items-center gap-3 bg-[#FAF9FD]">
                <img
                  src={currentConversation.avatar}
                  alt={currentConversation.activityTitle}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-[#1F1B3D] truncate">
                    {currentConversation.activityTitle}
                  </h4>
                  <span className="text-[10px] text-[#1E9E4A] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1E9E4A]" />
                    Онлайн в Тирасполе
                  </span>
                </div>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {currentConversation.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.isUser ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                        msg.isUser
                          ? 'bg-[#6545C6] text-white rounded-tr-none'
                          : 'bg-[#EEEAFB] text-[#1F1B3D] rounded-tl-none'
                      }`}
                    >
                      <p>{msg.text}</p>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-[#858394] px-1">
                      <span>{msg.time}</span>
                      {msg.isUser && <CheckCheck className="w-3 h-3 text-[#6545C6]" />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-[#E5E4F2] flex items-center gap-2 bg-white"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Напишите сообщение студии..."
                  className="flex-1 px-3 py-2 text-xs text-[#1F1B3D] bg-[#F7F6FC] border border-[#E5E4F2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6545C6]"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2.5 bg-[#6545C6] hover:bg-[#8064D8] disabled:opacity-50 text-white rounded-xl transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[#858394]">
              Выберите диалог для общения
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
