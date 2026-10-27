import React from 'react';
import { UserRole } from '../types';
import { Shield, User, Building, UserCheck } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  onOpenOwnerCabinet: () => void;
  onOpenModeratorCabinet: () => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentRole,
  onChangeRole,
  onOpenOwnerCabinet,
  onOpenModeratorCabinet,
}) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center p-1 bg-[#EEEAFB] rounded-xl text-xs font-semibold">
        <button
          onClick={() => onChangeRole('guest')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentRole === 'guest'
              ? 'bg-white text-[#6545C6] shadow-sm font-bold'
              : 'text-[#5B5870] hover:text-[#1F1B3D]'
          }`}
          title="Режим гостя: просмотр, фильтры, карта, звонок"
        >
          <User className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Гость</span>
        </button>

        <button
          onClick={() => onChangeRole('user')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentRole === 'user'
              ? 'bg-white text-[#6545C6] shadow-sm font-bold'
              : 'text-[#5B5870] hover:text-[#1F1B3D]'
          }`}
          title="Участник (Анна): избранное, голоса, отзывы, запись"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Участник</span>
        </button>

        <button
          onClick={() => {
            onChangeRole('owner');
            onOpenOwnerCabinet();
          }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentRole === 'owner'
              ? 'bg-[#6545C6] text-white shadow-sm font-bold'
              : 'text-[#5B5870] hover:text-[#1F1B3D]'
          }`}
          title="Владелец секции: управление своими анкетами"
        >
          <Building className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Владелец</span>
        </button>

        <button
          onClick={() => {
            onChangeRole('moderator');
            onOpenModeratorCabinet();
          }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentRole === 'moderator'
              ? 'bg-[#1F1B3D] text-white shadow-sm font-bold'
              : 'text-[#5B5870] hover:text-[#1F1B3D]'
          }`}
          title="Модератор: проверка очереди анкет и жалоб"
        >
          <Shield className="w-3.5 h-3.5 text-[#34D399]" />
          <span className="hidden md:inline">Модератор</span>
        </button>
      </div>
    </div>
  );
};
