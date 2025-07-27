import React from 'react';
import AlgoForm from './_components/AlgoForm';

export default function Page() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Quick Scope Trading Backtester
      </h1>
      <AlgoForm />
    </main>
  );
}
