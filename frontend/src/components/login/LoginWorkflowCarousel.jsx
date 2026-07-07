import React, { useEffect, useState } from 'react';
import { AnimatePresence, useReducedMotion, motion } from 'framer-motion';
import WorkflowDetailCard from '../workflow/WorkflowDetailCard.jsx';
import { workflow } from '../../pages/afinixLanding/afinixLandingContent.js';
import {
    WORKFLOW_FINAL_DURATION_MS,
    WORKFLOW_STEP_DURATION_MS,
} from '../../pages/afinixLanding/workflowConstants.js';

const LOGIN_BENEFIT_COPY_BY_STEP_ID = {
    recepcion: {
        title: 'Estado del caso en vivo',
        loginInsight: 'Avance, archivos y validación inicial siempre visibles.',
        loginProof: 'Menos llamadas de seguimiento.',
        loginKicker: 'Seguimiento',
        icon: 'bi-broadcast-pin',
    },
    diseno: {
        title: 'Revisión 3D clara',
        loginInsight: 'Aprueba o comenta el diseño antes de fabricar.',
        loginProof: 'Decisiones clínicas documentadas.',
        loginKicker: 'Diseño digital',
        icon: 'bi-bezier2',
    },
    aprobacion: {
        title: 'Aprobación trazable',
        loginInsight: 'Cada ajuste queda asociado al caso antes de producir.',
        loginProof: 'Menos sorpresas en prueba.',
        loginKicker: 'Control clínico',
        icon: 'bi-person-check',
    },
    produccion: {
        title: 'Operación centralizada',
        loginInsight: 'Laboratorio y clínica trabajan sobre la misma información.',
        loginProof: 'Menos reprocesos operativos.',
        loginKicker: 'Producción',
        icon: 'bi-diagram-3',
    },
    entrega: {
        title: 'Historial completo',
        loginInsight: 'Entregas, archivos y referencias disponibles para reposiciones.',
        loginProof: 'Trazabilidad posterior al caso.',
        loginKicker: 'Entrega',
        icon: 'bi-archive',
    },
};

const loginBenefitSlides = workflow.map((step) => {
    const benefitCopy = LOGIN_BENEFIT_COPY_BY_STEP_ID[step.id];

    return {
        ...step,
        ...benefitCopy,
    };
});

export default function LoginWorkflowCarousel() {
    const reduceMotion = useReducedMotion();
    const [activeStep, setActiveStep] = useState(0);
    const [isHoverPaused, setIsHoverPaused] = useState(false);
    const [isFocusPaused, setIsFocusPaused] = useState(false);

    const activeWorkflow = loginBenefitSlides[activeStep] ?? loginBenefitSlides[0];
    const regionLabel = `Beneficio del portal: ${activeWorkflow.title}. ${activeWorkflow.loginInsight || activeWorkflow.text}`;

    useEffect(() => {
        if (reduceMotion || isHoverPaused || isFocusPaused) {
            return undefined;
        }

        const isFinalStep = activeStep === loginBenefitSlides.length - 1;
        const duration = isFinalStep ? WORKFLOW_FINAL_DURATION_MS : WORKFLOW_STEP_DURATION_MS;

        const timeoutId = window.setTimeout(
            () => setActiveStep((current) => (current + 1) % loginBenefitSlides.length),
            duration,
        );

        return () => window.clearTimeout(timeoutId);
    }, [activeStep, isFocusPaused, isHoverPaused, reduceMotion]);

    const handleFocusCapture = () => setIsFocusPaused(true);
    const handleBlurCapture = (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsFocusPaused(false);
        }
    };

    return (
        <div
            className="login-workflow-panel"
            role="region"
            aria-label={regionLabel}
            onMouseEnter={() => setIsHoverPaused(true)}
            onMouseLeave={() => setIsHoverPaused(false)}
            onFocusCapture={handleFocusCapture}
            onBlurCapture={handleBlurCapture}
        >
            <div className="login-stories-indicators" aria-label="Beneficios del portal">
                {loginBenefitSlides.map((step, index) => {
                    const isCompleted = index < activeStep;
                    const isActive = index === activeStep;
                    const durationMs = (index === loginBenefitSlides.length - 1) ? WORKFLOW_FINAL_DURATION_MS : WORKFLOW_STEP_DURATION_MS;

                    return (
                        <button
                            key={step.id}
                            type="button"
                            className="login-stories-track"
                            onClick={() => setActiveStep(index)}
                            aria-label={`Ver beneficio ${index + 1}: ${step.title}`}
                            aria-current={isActive ? 'step' : undefined}
                        >
                            <div className="login-stories-fill-bg"></div>
                            {isActive && !isHoverPaused && !isFocusPaused && !reduceMotion && (
                                <motion.div
                                    className="login-stories-fill-active"
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{ duration: durationMs / 1000, ease: "linear" }}
                                    style={{ transformOrigin: "left" }}
                                />
                            )}
                            {(isCompleted || (isActive && (reduceMotion || isHoverPaused || isFocusPaused))) && (
                                <div className="login-stories-fill-active is-static-full" style={{ transform: 'scaleX(1)' }} />
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="login-workflow-detail-shell" aria-live="polite" aria-atomic="true">
                <AnimatePresence initial={false} mode="wait">
                    <WorkflowDetailCard
                        key={activeWorkflow.id}
                        step={activeWorkflow}
                        reduceMotion={reduceMotion}
                        variant="login"
                    />
                </AnimatePresence>
            </div>
        </div>
    );
}
