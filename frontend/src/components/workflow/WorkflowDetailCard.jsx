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
        mediaStep: 'login-workflow-detail-media-step',
        hud: 'login-workflow-hud-main',
        head: 'login-workflow-detail-head',
        icon: 'login-workflow-detail-icon',
        step: 'login-workflow-detail-step',
        benefit: 'login-workflow-benefit',
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
                        ? { opacity: 0, y: 12 }
                        : { opacity: 0, y: 18, filter: variant === 'landing' ? 'blur(10px)' : 'none' }
            }
            animate={
                reduceMotion
                    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                    : useMobileMotion
                        ? { opacity: 1, y: 0 }
                        : { opacity: 1, y: 0, filter: 'blur(0px)' }
            }
            exit={
                reduceMotion
                    ? { opacity: 1 }
                    : useMobileMotion
                        ? { opacity: 0, y: -10 }
                        : { opacity: 0, y: -16, filter: variant === 'landing' ? 'blur(10px)' : 'none' }
            }
            transition={
                reduceMotion
                    ? { duration: 0 }
                    : useMobileMotion
                        ? { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
                        : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
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
                <span className={classes.mediaStep} aria-hidden="true">
                    {step.number}
                </span>
            </figure>
            <div className={classes.hud}>
                <div className={classes.head}>
                    <div className={classes.icon} aria-hidden="true">
                        <i className={`bi ${step.icon}`}></i>
                    </div>
                    <div>
                        <span className={classes.step}>Paso {step.number}</span>
                        <h3>{step.title}</h3>
                    </div>
                </div>
                <p>{step.text}</p>
                {step.benefit ? (
                    <div className={classes.benefit}>
                        <i className="bi bi-star-fill" aria-hidden="true"></i>
                        <span>
                            <strong>Beneficio: </strong>
                            {step.benefit}
                        </span>
                    </div>
                ) : null}
            </div>
        </motion.article>
    );
}
