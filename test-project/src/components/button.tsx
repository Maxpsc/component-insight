import React from 'react';

export function Button({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <button onClick={onClick}>{children}</button>;
}

export function IconButton({ icon, onClick }: { icon: string; onClick?: () => void }) {
  return <button onClick={onClick}>{icon}</button>;
}
