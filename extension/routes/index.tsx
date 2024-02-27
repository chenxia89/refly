import { Route, Routes } from 'react-router-dom'

import { Home } from './home';
import { Thread } from '../components/thread-item/thread'
import { ThreadLibrary } from '../components/thread-library'

export const Routing = () => (
    <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/thread/:threadId" element={<Thread />} />
        <Route path="/thread" element={<ThreadLibrary />} />
    </Routes>
)