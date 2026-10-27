import React from 'react';
import { X, Building, Phone, Mail, Globe, MapPin, CheckCircle2 } from 'lucide-react';
import { Organization, ActivityItem } from '../types';

interface OrganizationModalProps {
  organization: Organization | null;
  isOpen: boolean;
  onClose: () => void;
  orgActivities: ActivityItem[];
  onSelectActivity: (act: ActivityItem) => void;
}

export const OrganizationModal: React.FC<OrganizationModalProps> = ({
  organization,
  isOpen,
  onClose,
  orgActivities,
  onSelectActivity,
}) => {
  if (!isOpen || !organization) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#E5E4F2] flex items-center justify-between bg-[#F7F6FC]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#6545C6] text-white flex items-center justify-center font-black text-lg shadow-md">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-extrabold text-[#6545C6] tracking-wider block">
                {organization.type}
              </span>
              <h3 className="font-black text-base sm:text-lg text-[#1F1B3D]">
                {organization.name}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#858394] hover:bg-[#EEEAFB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm text-[#5B5870]">
          {/* About */}
          <div>
            <h4 className="font-extrabold text-xs text-[#1F1B3D] uppercase tracking-wider mb-1.5">
              Об организации:
            </h4>
            <p className="leading-relaxed">{organization.description}</p>
          </div>

          {/* Contacts grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#FAF9FD] rounded-2xl border border-[#E5E4F2]">
            <div>
              <span className="text-[10px] text-[#858394] block">Телефон приемной:</span>
              <a href={`tel:${organization.phone}`} className="font-bold text-[#1F1B3D] text-xs hover:text-[#6545C6]">
                {organization.phone}
              </a>
            </div>

            {organization.email && (
              <div>
                <span className="text-[10px] text-[#858394] block">Электронная почта:</span>
                <span className="font-bold text-[#1F1B3D] text-xs">{organization.email}</span>
              </div>
            )}

            {organization.website && (
              <div>
                <span className="text-[10px] text-[#858394] block">Официальный сайт:</span>
                <a href={organization.website} target="_blank" rel="noreferrer" className="font-bold text-[#6545C6] text-xs hover:underline">
                  {organization.website}
                </a>
              </div>
            )}

            {organization.verifiedAt && (
              <div>
                <span className="text-[10px] text-[#858394] block">Верификация:</span>
                <span className="font-bold text-[#1E9E4A] text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Подтверждено {organization.verifiedAt}
                </span>
              </div>
            )}
          </div>

          {/* Published Activities (§3.10) */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-xs text-[#1F1B3D] uppercase tracking-wider">
              Все занятия организации ({orgActivities.length}):
            </h4>

            <div className="space-y-2">
              {orgActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => {
                    onClose();
                    onSelectActivity(act);
                  }}
                  className="p-3 bg-white rounded-xl border border-[#E5E4F2] hover:border-[#6545C6] flex items-center justify-between gap-3 cursor-pointer transition-all"
                >
                  <div>
                    <span className="font-black text-xs text-[#1F1B3D] block">{act.title}</span>
                    <span className="text-[11px] text-[#6545C6] font-bold">
                      от {act.groups[0]?.priceFrom} руб. ПМР / {act.groups[0]?.period}
                    </span>
                  </div>
                  <span className="text-xs text-[#6545C6] font-bold">Подробнее ➔</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
