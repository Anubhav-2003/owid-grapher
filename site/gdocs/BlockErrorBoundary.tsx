import React from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useDebug } from "./DebugContext.js"

export const BlockErrorBoundary = ({
    children,
}: {
    children: React.ReactNode
}) => {
    const debug = useDebug()
    return debug ? (
        <ErrorBoundary FallbackComponent={BlockErrorFallback}>
            {children}
        </ErrorBoundary>
    ) : (
        <>{children}</>
    )
}

export const BlockErrorFallback = ({
    error,
    resetErrorBoundary,
    className = "",
}: {
    error?: Error
    resetErrorBoundary: VoidFunction
    className?: string
}): JSX.Element => {
    return (
        <div
            className={className}
            style={{
                textAlign: "center",
                backgroundColor: "rgba(255,0,0,0.1)",
                padding: "20px",
            }}
        >
            <h3>Error while rendering the block</h3>
            Please check the source content.
            <div>
                <button style={{ margin: "10px" }} onClick={resetErrorBoundary}>
                    Try again
                </button>
            </div>
            <div>{error?.message}</div>
        </div>
    )
}
