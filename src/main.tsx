import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './styles/reset.css'
import './styles/variables.css'
import './styles/app.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const container = document.getElementById('mmb')
if (!container) {
  throw new Error('#mmb container not found')
}

createRoot(container).render(<RouterProvider router={router} />)
