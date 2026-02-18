import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, FilePlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './AdminLayout.module.css';

const AdminLayout = () => {
    const location = useLocation();
    const { logout } = useAuth();

    return (
        <div className={styles.container}>
            <aside className={styles.sidebar}>
                <div className={styles.logo}>
                    <img src="/assets/logo-full.png" alt="Skillture" className={styles.logoImg} />
                </div>
                <nav className={styles.nav}>
                    <Link
                        to="/admin/dashboard"
                        className={`${styles.navItem} ${location.pathname === '/admin/dashboard' ? styles.active : ''}`}
                    >
                        <LayoutDashboard size={20} />
                        Dashboard
                    </Link>
                    <Link
                        to="/admin/create-form"
                        className={`${styles.navItem} ${location.pathname === '/admin/create-form' ? styles.active : ''}`}
                    >
                        <FilePlus size={20} />
                        Create Form
                    </Link>
                </nav>
                <div className={styles.footer}>
                    <button className={styles.logoutBtn} onClick={logout}>
                        <LogOut size={20} />
                        Logout
                    </button>
                </div>
            </aside>
            <main className={styles.main}>
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;
