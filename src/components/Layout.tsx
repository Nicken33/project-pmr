import React from 'react';
import Head from 'next/head';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'CyberSprint' }) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Каталог кружков и секций Приднестровья" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen flex flex-col">
        {/* Здесь будет компонент Header */}
        <main className="flex-grow">{children}</main>
        {/* Здесь будет компонент Footer */}
      </div>
    </>
  );
};

export default Layout;
