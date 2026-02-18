import React from 'react';
import { Outlet } from 'react-router-dom';
import styles from './PublicLayout.module.css';

const PublicLayout = () => {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.logo}>
                    <img src="/assets/logo-full.png" alt="Skillture" className={styles.logoImg} />
                </div>
            </header>
            <main className={styles.main}>
                <Outlet />
            </main>
            <footer className={styles.footer}>
                &copy; {new Date().getFullYear()} Skillture. All rights reserved.
            </footer>
        </div>
    );
};

export default PublicLayout;
