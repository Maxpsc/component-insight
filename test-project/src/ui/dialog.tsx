import React from 'react';

export default function Dialog({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dialog">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
