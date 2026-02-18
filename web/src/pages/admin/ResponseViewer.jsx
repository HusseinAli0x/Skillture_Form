import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download } from 'lucide-react';
import styles from './ResponseViewer.module.css';

const ResponseViewer = () => {
    const { id } = useParams(); // Form ID
    const [responses, setResponses] = useState([]);
    const [form, setForm] = useState(null);
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [formRes, fieldsRes, responsesRes] = await Promise.all([
                api.get(`/forms/${id}`),
                api.get(`/forms/${id}/fields`),
                api.get(`/forms/${id}/responses`)
            ]);
            setForm(formRes.data);
            setFields((fieldsRes.data || []).sort((a, b) => a.field_order - b.field_order));
            setResponses(responsesRes.data || []);
        } catch (err) {
            console.error('Failed to load responses', err);
        } finally {
            setLoading(false);
        }
    };

    const getAnswerValue = (response, fieldId) => {
        const answer = response.answers?.find(a => a.field_id === fieldId);
        if (!answer) return '-';
        // Logic to extract value based on type
        if (answer.value?.text) return answer.value.text;
        if (answer.value?.selected) {
            const sel = answer.value.selected;
            return Array.isArray(sel) ? sel.join('; ') : sel;
        }
        return JSON.stringify(answer.value);
    };

    const escapeCsvCell = (value) => {
        const str = String(value ?? '');
        // Wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const handleExportCSV = () => {
        // Build header row
        const headers = [
            'Respondent Name',
            'Respondent Email',
            'Submitted At',
            ...fields.map(f => f.label?.en || 'Question')
        ];

        // Build data rows
        const rows = responses.map(response => [
            response.respondent?.name || 'Anonymous',
            response.respondent?.email || '',
            new Date(response.submitted_at || response.created_at).toLocaleString(),
            ...fields.map(field => getAnswerValue(response, field.id))
        ]);

        // Convert to CSV string
        const csvContent = [
            headers.map(escapeCsvCell).join(','),
            ...rows.map(row => row.map(escapeCsvCell).join(','))
        ].join('\n');

        // Add BOM for proper UTF-8 handling in Excel (important for Arabic text)
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        const formTitle = (form?.title || 'responses').replace(/[^a-zA-Z0-9]/g, '_');
        link.download = `${formTitle}_responses.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (loading) return <div className={styles.loading}>Loading responses...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>Responses for: {form?.title}</h1>
                    <span className={styles.count}>{responses.length} responses</span>
                </div>
                {responses.length > 0 && (
                    <Button onClick={handleExportCSV} className={styles.exportBtn}>
                        <Download size={16} style={{ marginRight: '0.5rem' }} />
                        Export CSV
                    </Button>
                )}
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Respondent</th>
                            <th>Submitted At</th>
                            {fields.map(field => (
                                <th key={field.id}>{field.label?.en || 'Question'}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {responses.map(response => (
                            <tr key={response.id}>
                                <td>
                                    <div className={styles.respondent}>
                                        <div>{response.respondent?.name || 'Anonymous'}</div>
                                        <div className={styles.email}>{response.respondent?.email}</div>
                                    </div>
                                </td>
                                <td>{new Date(response.submitted_at || response.created_at).toLocaleString()}</td>
                                {fields.map(field => (
                                    <td key={field.id} className={styles.answerCell}>
                                        {getAnswerValue(response, field.id)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {responses.length === 0 && (
                            <tr>
                                <td colSpan={fields.length + 2} className={styles.empty}>No responses yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ResponseViewer;

