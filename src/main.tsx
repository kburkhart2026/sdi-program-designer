import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Token order matters: fonts first (they carry the @import), then the palette,
// then type/spacing/effects, then this tool's additions, then the base layer.
import './styles/tokens/fonts.css'
import './styles/tokens/colors.css'
import './styles/tokens/typography.css'
import './styles/tokens/spacing.css'
import './styles/tokens/effects.css'
import './styles/app-tokens.css'
import './styles/global.css'

import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
