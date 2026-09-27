import React from 'react';
import { motion } from 'framer-motion';

const classMap = {
    landing: {
        card: 'afinix-workflow-detail-card',
        media: 'afinix-workflow-detail-media',
        mediaStep: 'afinix-workflow-detail-media-step',
        hud: 'afinix-workflow-hud-main',
        head: 'afinix-workflow-detail-head',
        icon: 'afinix-workflow-detail-icon',
        step: 'afinix-workflow-detail-step',
        benefit: 'afinix-workflow-benefit',
    },
    login: {
        card: 'login-workflow-detail-card',
        media: 'login-workflow-detail-media',
    },
};

export default function WorkflowDetailCard({
    step,
    reduceMotion,
    className = '',
    mobilePopover = false,
    variant = 'landing',
}) {
    const classes = classMap[variant] ?? classMap.landing;
    const useMobileMotion = mobilePopover && !reduceMotion;

    return (
        <motion.article
            key={step.id}
            className={`${classes.card} ${className}`.trim()}
            initial={
                reduceMotion
                    ? false
                    : useMobileMotion
                        ? { opacity: 0, y: 10 }
                        : { opacity: 0, y: 12 }
            }
            animate={
                reduceMotion
                    ? { opacity: 1, y: 0 }
                    : useMobileMotion
                        ? { opacity: 1, y: 0 }
                        : { opacity: 1, y: 0 }
            }
            exit={
                reduceMotion
                    ? { opacity: 1 }
                    : useMobileMotion
                        ? { opacity: 0, y: -8 }
                        : { opacity: 0, y: -10 }
            }
            transition={
                reduceMotion
                    ? { duration: 0 }
                    : useMobileMotion
                        ? { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
                        : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
            }
        >
            <figure className={classes.media}>
                <motion.img
                    src={step.image}
                    alt={step.imageAlt}
                    loading="lazy"
                    decoding="async"
                    style={{ objectPosition: step.imagePosition || 'center' }}
                    initial={reduceMotion ? false : { opacity: 0.4, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
                {variant === 'landing' && (
                    <span className={classes.mediaStep} aria-hidden="true">
                        {step.number}
                    </span>
                )}
                {variant === 'login' ? (
                    <figcaption className="login-workflow-media-caption">
                        <span className="login-workflow-step-kicker">{step.loginKicker ?? `PASO ${step.number}`}</span>
                        <h3>{step.title}</h3>
                        <p className="login-workflow-insight">{step.loginInsight ?? step.text}</p>
                        {step.loginProof ? (
                            <span className="login-workflow-proof">
                                <i className="bi bi-check2-circle" aria-hidden="true"></i>
                                {step.loginProof}
                            </span>
                        ) : null}
                    </figcaption>
                ) : null}
            </figure>
            {variant === 'login' ? null : (
                <div className={classes.hud}>
                    <div className="afinix-workflow-kicker-pill">
                        <i className={`bi ${step.icon}`} aria-hidden="true"></i>
                        <span>PASO {step.number} · {step.title.toUpperCase()}</span>
                    </div>
                    <h3 className="afinix-workflow-hero-action">{step.action || step.text}</h3>
                    {step.chips && step.chips.length > 0 ? (
                        <div className="afinix-workflow-chips">
                            {step.chips.map((chip) => (
                                <div key={chip} className="afinix-workflow-chip">
                                    <span className="afinix-workflow-chip-icon" aria-hidden="true">
                                        <i className="bi bi-check2"></i>
                                    </span>
                                    <span className="afinix-workflow-chip-text">{chip}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            )}
        </motion.article>
    );
}
