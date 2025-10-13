import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create a React Query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,  // Don't refetch on window focus
      retry: 1,                       // Retry failed requests once
      staleTime: 5 * 60 * 1000,      // Data is fresh for 5 minutes
      gcTime: 10 * 60 * 1000,        // Cache data for 10 minutes
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
