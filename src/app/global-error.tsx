
'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'sans-serif',
          padding: '2rem'
        }}>
          <h2>Something went wrong!</h2>
          <p style={{ color: '#666', margin: '1rem 0' }}>
            A global error occurred in the application layout or template.
          </p>
          <pre style={{ 
            background: '#f0f0f0', 
            border: '1px solid #ccc', 
            borderRadius: '4px', 
            padding: '1rem', 
            maxWidth: '800px', 
            overflow: 'auto'
          }}>
            {error.message}
          </pre>
          <Button onClick={() => reset()} style={{ marginTop: '1rem' }}>
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
