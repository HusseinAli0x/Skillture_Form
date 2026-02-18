import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Trash2, MessageSquare, Edit, Share2, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import styles from './Dashboard.module.css';

const Dashboard = () => {
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchForms();
    }, []);

    const fetchForms = async () => {
        try {
            const res = await api.get('/forms/');
            setForms(res.data || []);
        } catch (error) {
            console.error('Failed to fetch forms', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this form?')) return;
        try {
            await api.delete(`/forms/${id}`);
            setForms(forms.filter(f => f.id !== id));
        } catch (error) {
            console.error('Failed to delete form', error);
        }
    };

    const handleShare = async (formId) => {
        const url = `${window.location.origin}/forms/${formId}`;
        try {
            await navigator.clipboard.writeText(url);
            alert('Form link copied to clipboard!');
        } catch {
            // Fallback for non-HTTPS
            prompt('Copy this link:', url);
        }
    };

    const handleToggleStatus = async (form) => {
        try {
            if (form.status === 1) {
                // Active → Close
                await api.post(`/forms/${form.id}/close`);
            } else {
                // Draft/Closed → Activate
                await api.post(`/forms/${form.id}/publish`);
            }
            fetchForms();
        } catch (error) {
            console.error('Failed to toggle form status', error);
            alert('Failed to change form status');
        }
    };

    const getStatusToggle = (form) => {
        const isActive = form.status === 1;
        return (
            <button
                className={`${styles.statusToggle} ${isActive ? styles.statusToggleActive : styles.statusToggleInactive}`}
                onClick={() => handleToggleStatus(form)}
                title={isActive ? 'Deactivate form' : 'Activate form'}
            >
                {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {isActive ? 'Active' : form.status === 2 ? 'Closed' : 'Draft'}
            </button>
        );
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Dashboard</h1>
                <Link to="/admin/create-form">
                    <Button>
                        <Plus size={18} style={{ marginRight: '0.5rem' }} />
                        Create New Form
                    </Button>
                </Link>
            </header>

            {loading ? (
                <div>Loading forms...</div>
            ) : forms.length === 0 ? (
                <Card className={styles.emptyState}>
                    <p>No forms found. Create your first one!</p>
                </Card>
            ) : (
                <div className={styles.grid}>
                    {forms.map(form => (
                        <Card key={form.id} className={styles.formCard}>
                            <div className={styles.cardHeader}>
                                <Link to={`/admin/forms/${form.id}/edit`} className={styles.formTitleLink}>
                                    <h3 className={styles.formTitle}>{form.title}</h3>
                                </Link>
                                {getStatusToggle(form)}
                            </div>
                            <p className={styles.formDesc}>{form.description || 'No description'}</p>
                            <div className={styles.cardFooter}>
                                <div className={styles.actions}>
                                    <Link to={`/forms/${form.id}`} target="_blank" title="Preview Form">
                                        <Button variant="secondary" className={styles.iconBtn}>
                                            <Eye size={16} />
                                        </Button>
                                    </Link>
                                    <Link to={`/admin/forms/${form.id}/responses`} title="View Responses">
                                        <Button variant="secondary" className={styles.iconBtn}>
                                            <MessageSquare size={16} />
                                        </Button>
                                    </Link>
                                    <Link to={`/admin/forms/${form.id}/edit`} title="Edit Form">
                                        <Button variant="secondary" className={styles.iconBtn}>
                                            <Edit size={16} />
                                        </Button>
                                    </Link>
                                    <Button variant="secondary" className={styles.iconBtn} title="Share" onClick={() => handleShare(form.id)}>
                                        <Share2 size={16} />
                                    </Button>
                                    <Button
                                        variant="danger"
                                        className={styles.iconBtn}
                                        onClick={() => handleDelete(form.id)}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                                <span className={styles.date}>
                                    {new Date(form.creat_at || form.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Dashboard;


