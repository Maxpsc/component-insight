import React from 'react';

export default function ButtonWrapper({ children }: { children: React.ReactNode }) {
  return <div className="button-wrapper">{children}</div>;
}
