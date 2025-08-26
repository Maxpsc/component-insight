import React from 'react';

export function SubButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <button onClick={onClick}>{children}</button>;
}

export function SubButton2({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <button onClick={onClick}>{children}</button>;
}