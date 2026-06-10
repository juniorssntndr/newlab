import React, { useEffect } from 'react';

/**
 * Inserta JSON-LD en el documento sin afectar el layout.
 * @param {{ id: string, data: object | object[] }} props
 */
export default function JsonLd({ id, data }) {
    const serialized = JSON.stringify(data);

    useEffect(() => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = id;
        script.text = serialized;
        document.head.appendChild(script);
        return () => {
            document.getElementById(id)?.remove();
        };
    }, [id, serialized]);

    return null;
}
