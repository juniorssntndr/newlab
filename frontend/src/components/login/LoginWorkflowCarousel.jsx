import React, { useEffect, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import WorkflowDetailCard from '../workflow/WorkflowDetailCard.jsx';
import { workflow } from '../../pages/afinixLanding/afinixLandingContent.js';
import {
    WORKFLOW_FINAL_DURATION_MS,
    WORKFLOW_STEP_DURATION_MS,
} from '../../pages/afinixLanding/workflowConstants.js';

export default function LoginWorkflowCarousel() {
    const reduceMotion = useReducedMotion();
    const [activeStep, setActiveStep] = useState(0);
    const [isHoverPaused, setIsHoverPaused] = useState(false);
    const [isFocusPaused, setIsFocusPaused] = useState(false);

    const activeWorkflow = workflow[activeStep] ?? workflow[0];
    const stepProgress = workflow.length > 1 ? activeStep / (workflow.length - 1) : 1;

    useEffect(() => {
        if (reduceMotion || isHoverPaused || isFocusPaused) {
            return undefined;
        }

        const isFinalStep = activeStep === workflow.length - 1;
        const timeoutId = window.setTimeout(
            () => setActiveStep((current) => (current + 1) % workflow.length),
            isFinalStep ? WORKFLOW_FINAL_DURATION_MS : WORKFLOW_STEP_DURATION_MS,
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
            aria-label="Flujo digital AFINIX"
            onMouseEnter={() => setIsHoverPaused(true)}
            onMouseLeave={() => setIsHoverPaused(false)}
            onFocusCapture={handleFocusCapture}
            onBlurCapture={handleBlurCapture}
        >
            <div className="login-workflow-progress" aria-hidden="true">
                <div className="login-workflow-progress-meta">
                    <strong>
                        Paso {activeWorkflow.number} de {String(workflow.length).padStart(2, '0')}
                    </strong>
                    <span>{Math.round(stepProgress * 100)}% completado</span>
                </div>
                <div className="login-workflow-progress-track">
                    <div
                        className="login-workflow-progress-fill"
                        style={{
                            transform: `scaleX(${Math.max(0.04, stepProgress)})`,
                            transition: reduceMotion ? 'none' : 'transform 0.22s linear',
                        }}
                    />
                </div>
            </div>

            <ol className="login-workflow-grid" aria-label="Etapas del flujo digital">
                {workflow.map((step, index) => {
                    const stepState =
                        index === activeStep
                            ? 'is-active'
                            : index < activeStep
                                ? 'is-complete'
                                : 'is-upcoming';

                    return (
                        <li
                            className={`login-workflow-card ${stepState}`}
                            key={step.id}
                            aria-current={index === activeStep ? 'step' : undefined}
                        >
                            <button
                                type="button"
                                className="login-workflow-step-button"
                                onClick={() => setActiveStep(index)}
                                aria-label={`Ver paso ${step.number}: ${step.title}`}
                            >
                                <span className="login-workflow-card-head">
                                    <span className="login-workflow-step-num">{step.number}</span>
                                </span>
                                <span className="login-workflow-step-icon" aria-hidden="true">
                                    <i className={`bi ${step.icon}`}></i>
                                </span>
                                <h3>{step.title}</h3>
                                <p>{step.status}</p>
                            </button>
                        </li>
                    );
                })}
            </ol>

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
