import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated Live Tracking Radar Icon (Lucide + Framer Motion style)
 */
export default function AnimatedRadar({ size = 16, className = '' }) {
    return (
        <motion.svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <motion.path
                d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ originX: '12px', originY: '12px' }}
            />
            <motion.path
                d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"
                animate={{ opacity: [0.1, 0.8, 0.1], scale: [0.92, 1.08, 0.92] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                style={{ originX: '12px', originY: '12px' }}
            />
        </motion.svg>
    );
}
