import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import OrganizationCard from '@/components/OrganizationCard';
import { mockOrganizations } from '@/mocks/data';

export default function OrganizationPage() {
  const router = useRouter();
  const { id } = router.query;

  const organization = typeof id === 'string'
    ? mockOrganizations.find((org) => org.id === id)
    : undefined;

  if (!router.isReady) return <p className="text-gray-600">Загрузка…</p>;

  return (
    <main className="container mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Карточка организации</h1>
      {organization ? (
        <div className="max-w-2xl">
          <OrganizationCard organization={organization} />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600">Организация не найдена.</p>
          <Link href="/map" className="text-blue-600 underline">
            Вернуться к карте
          </Link>
        </div>
      )}
    </main>
  );
}
