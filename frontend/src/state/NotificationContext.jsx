import { API_URL } from '../config.js';

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [panelOpen, setPanelOpen] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_URL}/notificaciones`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.items);
                setUnreadCount(data.no_leidas);
            }
        } catch (e) { /* silent */ }
    }, [token]);

    useEffect(() => {
        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        }
    }, [user, fetchNotifications]);

    const markAsRead = async (id) => {
        try {
            await fetch(`${API_URL}/notificaciones/${id}/leer`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchNotifications();
        } catch (e) { /* silent */ }
    };

    const markAllRead = async () => {
        try {
            await fetch(`${API_URL}/notificaciones/leer-todas`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchNotifications();
        } catch (e) { /* silent */ }
    };

    return (
        <NotificationContext.Provider value={{
            notifications, unreadCount, panelOpen, setPanelOpen,
            markAsRead, markAllRead, fetchNotifications
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
