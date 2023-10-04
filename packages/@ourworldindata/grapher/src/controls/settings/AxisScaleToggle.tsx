import React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { ScaleType } from "../../core/GrapherConstants"
import { AxisConfig } from "../../axis/AxisConfig"
import classnames from "classnames"

@observer
export class AxisScaleToggle extends React.Component<{
    axis: AxisConfig
    subtitle?: string
    prefix?: string
}> {
    @action.bound private setAxisScale(scale: ScaleType): void {
        this.props.axis.scaleType = scale
    }

    render(): JSX.Element {
        const { linear, log } = ScaleType,
            { axis, prefix, subtitle } = this.props,
            isLinear = axis.scaleType === linear,
            label = prefix ? `${prefix}: ` : undefined

        return (
            <>
                <div className="config-toggle">
                    {subtitle && <label>{subtitle}</label>}
                    <button
                        className={classnames({ active: isLinear })}
                        onClick={(): void => this.setAxisScale(linear)}
                    >
                        {label}Linear
                    </button>
                    <button
                        className={classnames({ active: !isLinear })}
                        onClick={(): void => this.setAxisScale(log)}
                    >
                        {label}Logarithmic
                    </button>
                </div>
            </>
        )
    }
}
