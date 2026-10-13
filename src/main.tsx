import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
// 设备标识的 fetch 补丁必须在应用渲染前装好：晚了的话最先发出的一批
// 请求（经历库列表）就会不带 X-CV-Owner，线上会看到别人的库
import './lib/device'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
