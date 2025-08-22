import React from 'react';

export function Input({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function TextArea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} />;
}
