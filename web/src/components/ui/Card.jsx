import React from 'react';
import styles from './Card.module.css';

const Card = ({ children, title, className = '', ...props }) => {
    return (
        <div className={`${styles.card} ${className}`} {...props}>
            {title && <h3 className={styles.title}>{title}</h3>}
            <div className={styles.content}>{children}</div>
        </div>
    );
};

export default Card;
