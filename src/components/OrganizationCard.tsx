import React from 'react';
import { MapPin, Phone, Users } from 'lucide-react';
import { Organization } from '@/types';

interface OrganizationCardProps {
  organization: Organization;
}

const OrganizationCard: React.FC<OrganizationCardProps> = ({ organization }) => {
  // TODO (QodeX): Подключить API для получения данных организации
  // TODO (QodeX): Реализовать отображение отзывов (§10.2: звёзд в каталоге нет)

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
      <div className="flex flex-col space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">{organization.name}</h2>
        <p className="text-gray-600 leading-relaxed">{organization.description}</p>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-gray-500" />
            <p className="text-gray-700">{organization.address}</p>
          </div>

          <div className="flex items-center space-x-2">
            <Phone className="w-5 h-5 text-gray-500" />
            <p className="text-gray-700">{organization.contacts}</p>
          </div>

          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-gray-500" />
            <p className="text-gray-700">
              {organization.ageRange[0]}–{organization.ageRange[1]} лет
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {organization.tags.map((tag) => (
            <span
              key={tag}
              className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrganizationCard;
