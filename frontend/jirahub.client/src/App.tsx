// Full App.tsx for JIRA Hub v2 (clean rebuild)
import { useState } from 'react';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h1>JIRA Hub v2</h1>
        <p>Login screen would go here</p>
        <button onClick={() => setIsLoggedIn(true)}>Login as Admin (Demo)</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>JIRA Hub v2 - Ticket Review App</h1>
      <p>Search, filter, and comment on JIRA/SCR tickets.</p>
      {/* Full app UI would go here */}
    </div>
  );
}