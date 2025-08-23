import React, { useState } from 'react';

const Places = () => {
  const [query, setQuery] = useState('')

  // Placeholder items until real data is wired
  const myPlaces = [
    { id: '1', name: 'Cozy Cat Cafe', address: '123 Main St' },
    { id: '2', name: 'Sunny Park', address: '456 Oak Ave' },
    { id: '3', name: 'Late Night Diner', address: '789 Pine Rd' }
  ]

  const filtered = myPlaces.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.address.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Places</h1>
      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search saved places..."
          className="w-full px-4 py-2 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-charcoal-500">{query ? 'No places found.' : 'This page will show all the places you have saved.'}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="rounded-xl border border-linen-200 bg-white p-3 shadow-soft">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-charcoal-500">{p.address}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Places;
