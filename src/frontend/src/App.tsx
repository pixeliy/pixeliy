import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PeersProvider } from './contexts/PeersContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';
import NotFound from './pages/NotFound';

function App() {
    return (
        <AuthProvider>
            <PeersProvider>
                <Router>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/room/:id" element={<Room />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Router>
            </PeersProvider>
        </AuthProvider>
    );
}

export default App;