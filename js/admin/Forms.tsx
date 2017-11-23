/* Forms.tsx
 * ================
 *
 * Reusable React components to keep admin form code succint and consistent
 */

import * as React from 'react'
import { extend, pick } from '../charts/Util'
import { bind } from 'decko'
import { Button as SButton, Form, Checkbox, Select, TextArea, Segment, SegmentProps, SegmentGroupProps, Header } from 'semantic-ui-react'
import {observable, action} from 'mobx'
import {observer} from 'mobx-react'
import Colorpicker from './Colorpicker'

export class FieldsRow extends React.Component<{}> {
    render() {
        const {props} = this
        return <div className="FieldsRow">
            {props.children}
        </div>
    }
}

export interface TextFieldProps extends React.HTMLAttributes<HTMLLabelElement> {
    label?: string,
    value: string | undefined,
    onValue: (value: string) => void,
    onEnter?: () => void,
    onEscape?: () => void,
    placeholder?: string,
    title?: string,
    disabled?: boolean,
    helpText?: string,
    fullWidth?: boolean,
    autofocus?: boolean
}

export class TextField extends React.Component<TextFieldProps> {
    @bind onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
        if (ev.key === "Enter" && this.props.onEnter) {
            this.props.onEnter()
        } else if (ev.key === "Escape" && this.props.onEscape) {
            this.props.onEscape()
        }
    }

    base: HTMLDivElement
    componentDidMount() {
        if (this.props.autofocus) {
            const input = this.base.querySelector("input") as HTMLInputElement
            input.focus()
        }
    }

    render() {
        const { props } = this
        const passthroughProps = pick(props, ['placeholder', 'title', 'disabled'])

        return <Form.Field>
            {props.label && <label>{props.label}</label>}
            <div className="ui input">
                <input type="text" value={props.value} onInput={e => this.props.onValue(e.currentTarget.value)} {...passthroughProps}/>
            </div>
            {props.helpText && <small>{props.helpText}</small>}
        </Form.Field>
    }
}

export class TextAreaField extends React.Component<TextFieldProps> {
    @bind onInput(ev: React.FormEvent<HTMLTextAreaElement>) {
        const value = ev.currentTarget.value
        this.props.onValue(value)
    }

    render() {
        const { props } = this
        const passthroughProps = pick(props, ['placeholder', 'title', 'disabled', 'label', 'helpText'])

        return <Form.Field>
            {props.label && <label>{props.label}</label>}
            <TextArea value={props.value} onInput={this.onInput} {...passthroughProps}/>
            {props.helpText && <small>{props.helpText}</small>}
        </Form.Field>
    }
}

export interface NumberFieldProps {
    label?: string,
    value: number | undefined,
    onValue: (value: number|undefined) => void,
    onEnter?: () => void,
    onEscape?: () => void,
    placeholder?: string,
    title?: string,
    disabled?: boolean,
    helpText?: string,
    fullWidth?: boolean
}

export class NumberField extends React.Component<NumberFieldProps> {
    render() {
        const { props } = this

        const textFieldProps = extend({}, props, {
            value: props.value !== undefined ? props.value.toString() : undefined,
            onValue: (value: string) => {
                const asNumber = parseFloat(value)
                props.onValue(isNaN(asNumber) ? undefined : asNumber)
            }
        })

        return <TextField {...textFieldProps}/>
    }
}

export interface SelectFieldProps {
    label?: string,
    value: string | undefined,
    onValue: (value: string | undefined) => void,
    options: string[],
    optionLabels?: string[],
    helpText?: string
}

export class SelectField extends React.Component<SelectFieldProps> {
    render() {
        const { props } = this

        const options = props.options.map((opt, i) => {
            return {
                key: opt,
                value: opt,
                text: (props.optionLabels && props.optionLabels[i]) || opt
            }
        })

        return <Form.Field>
            {props.label && <label>{props.label}</label>}
            <Select label={props.label} value={props.value} options={options} onChange={(_, select) => props.onValue(select.value as string|undefined)}/>
            {props.helpText && <small>{props.helpText}</small>}
        </Form.Field>
    }
}

export interface NumericSelectFieldProps {
    label?: string,
    value: number,
    onValue: (value: number) => void,
    options: number[],
    optionLabels?: string[],
    helpText?: string
}

export class NumericSelectField extends React.Component<NumericSelectFieldProps> {
    render() {
        const props = extend({}, this.props, {
            value: this.props.value.toString(),
            options: this.props.options.map(opt => opt.toString()),
            onValue: (value: string|undefined) => {
                const asNumber = parseFloat(value as string)
                this.props.onValue(asNumber)
            }
        })
        return <SelectField {...props}/>
    }
}

export interface ToggleProps {
    label: string|JSX.Element,
    value: boolean,
    onValue: (value: boolean) => void
}

export class Toggle extends React.Component<ToggleProps> {
    render() {
        const { props } = this
        /*return <div className="mdc-form-field">

        </div>*/

        return <Form.Field>
            <Checkbox label={props.label} checked={props.value} onChange={(_, box) => props.onValue(!!box.checked)}/>
        </Form.Field>
        /* return <FormField>
           <Checkbox checked={props.value} onChange={/> <label>{props.label}</label>
       </FormField>
       return <label className="Toggle clickable">
           <input type="checkbox" checked={props.value}  />
           {" " + props.label}
       </label>*/
    }
}

export interface ButtonProps {
    onClick: () => void
    label?: string
}

export class Button extends React.Component<ButtonProps> {
    render() {
        const { props } = this
        return <SButton onClick={props.onClick}>{props.label}{props.children}</SButton>
    }
}

export class EditableList extends React.Component<SegmentGroupProps> {
    render() {
        return this.props.children ? <Segment.Group {...this.props}/> : null
    }
}

export type EditableListItemProps = SegmentProps

export class EditableListItem extends React.Component<EditableListItemProps> {
    render() {
        return <Segment {...this.props}/>
    }
}

@observer
export class ColorBox extends React.Component<{ color: string|undefined, onColor: (color: string) => void }> {
    @observable.ref isChoosingColor = false

    @action.bound onClick() {
        this.isChoosingColor = !this.isChoosingColor
    }

    render() {
        const { color } = this.props
        const { isChoosingColor } = this

        const style = color !== undefined ? { backgroundColor: color } : undefined

        return <div className="ColorBox" style={style} onClick={this.onClick}>
            {color === undefined && <i className="fa fa-paint-brush"/>}
            {isChoosingColor && <Colorpicker color={color} onColor={this.props.onColor} onClose={() => this.isChoosingColor = false} />}
        </div>
    }
}

export class Section extends React.Component<{ name: string }> {
    render() {
        return <section>
            <Header as='h3' dividing>{this.props.name}</Header>
            {this.props.children}
        </section>
    }
}
