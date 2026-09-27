import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated Checkmark Icon (Lucide + Framer Motion style)
 * Smooth stroke drawing animation when rendered or activated.
 */
export default function AnimatedCheck({ size = 16, className = '', strokeWidth = 2.5 }) {
    return (
        <motion.svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <motion.path
                d="M20 6L9 17L4 12"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
        </motion.svg>
    );
}
