import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import api from '../../services/api';
import styles from './CreateForm.module.css';

const CreateForm = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ title: '', description: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/forms/', formData);
            // Redirect to form builder or dashboard
            // For now dashboard, ideally builder to add fields
            // navigate(`/admin/forms/${res.data.id}/edit`);
            navigate('/admin/dashboard');
        } catch (error) {
            console.error('Failed to create form', error);
            alert('Failed to create form');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <Card title="Create New Form" className={styles.card}>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <Input
                        label="Form Title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Customer Feedback Survey"
                        required
                    />
                    <div className={styles.textareaGroup}>
                        <label className={styles.label}>Description</label>
                        <textarea
                            className={styles.textarea}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe the purpose of this form..."
                        />
                    </div>
                    <div className={styles.actions}>
                        <Button type="button" variant="secondary" onClick={() => navigate('/admin/dashboard')}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Form'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default CreateForm;
