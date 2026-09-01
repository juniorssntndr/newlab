import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated Sun/Moon Icon (Lucide + Framer Motion style)
 * Smooth morph/rotation transition between Light and Dark mode.
 */
export default function SunMoonAnimatedIcon({ isDark, size = 18, className = '' }) {
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
            initial={false}
            animate={{
                rotate: isDark ? 40 : 0,
                scale: [0.85, 1.05, 1],
            }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
            {isDark ? (
                // Moon with subtle stars
                <motion.g
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" />
                    <motion.path
                        d="M19 3v4M21 5h-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ delay: 0.15, duration: 0.35 }}
                    />
                </motion.g>
            ) : (
                // Sun with radiating rays
                <motion.g
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                    <motion.g
                        animate={{ rotate: 360 }}
                        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                        style={{ originX: '12px', originY: '12px' }}
                    >
                        <line x1="12" y1="2" x2="12" y2="4" />
                        <line x1="12" y1="20" x2="12" y2="22" />
                        <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                        <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                        <line x1="2" y1="12" x2="4" y2="12" />
                        <line x1="20" y1="12" x2="22" y2="12" />
                        <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
                        <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
                    </motion.g>
                </motion.g>
            )}
        </motion.svg>
    );
}
