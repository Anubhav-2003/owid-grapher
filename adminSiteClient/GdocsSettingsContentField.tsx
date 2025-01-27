import React from "react"
import { Input, InputProps } from "antd"
import {
    OwidGdocInterface,
    OwidGdocContent,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
} from "@ourworldindata/utils"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"
import { getPropertyMostCriticalError } from "./gdocsValidation.js"
import { TextAreaProps } from "antd/lib/input/TextArea.js"
import { Help } from "./Forms.js"

export const GdocsSettingsContentField = ({
    gdoc,
    property,
    render = (props) => <GdocsSettingsTextField {...props} />,
    errors,
    description,
}: {
    gdoc: OwidGdocInterface
    property: keyof OwidGdocContent
    render?: ({
        name,
        value,
        errorType,
    }: {
        name: string
        value: string
        errorType?: OwidGdocErrorMessageType
    }) => JSX.Element
    errors?: OwidGdocErrorMessage[]
    description?: string
}) => {
    const error = getPropertyMostCriticalError(property, errors)

    return (
        <div className="form-group">
            <label htmlFor={property}>
                <span className="text-capitalize">{property}</span>
            </label>
            <div className="edit-in-gdocs">
                <GdocsEditLink gdocId={gdoc.id} />
                {render({
                    name: property,
                    value: gdoc.content[property] as string,
                    errorType: error?.type,
                })}
            </div>
            <GdocsErrorHelp error={error} />
            {description ? <Help>{description}</Help> : null}
        </div>
    )
}

export const GdocsSettingsTextField = ({
    name,
    value,
    errorType,
    inputProps,
}: {
    name: string
    value: string
    errorType?: OwidGdocErrorMessageType
    inputProps?: InputProps
}) => (
    <Input
        addonBefore={`${name}:`}
        value={value}
        status={errorType}
        id={name}
        readOnly
        {...inputProps}
    />
)

export const GdocsSettingsTextArea = ({
    name,
    value,
    errorType,
    inputProps,
}: {
    name: string
    value: string
    errorType?: OwidGdocErrorMessageType
    inputProps?: TextAreaProps
}) => (
    <Input.TextArea
        value={value}
        status={errorType}
        id={name}
        readOnly
        {...inputProps}
    />
)
